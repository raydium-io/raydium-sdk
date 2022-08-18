import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { intersection, xor } from "lodash";

import { ApiLiquidityPoolInfo } from "../../api/type";
import { BN_ZERO } from "../../common/bignumber";
import { div, gte } from "../../common/fractionUtil";
import { jsonInfo2PoolKeys } from "../../common/utility";
import { CurrencyAmount, Percent, Price, Token, TokenAmount } from "../../module";
import { getPoolEnabledFeatures, includesToken } from "../liquidity/util";
import ModuleBase from "../moduleBase";
import { MakeTransaction } from "../type";

import { defaultRoutes, ROUTE_PROGRAM_ID_V1, swapRouteMiddleMints } from "./constant";
import { makeSwapInFixedInInstruction, makeSwapOutFixedInInstruction } from "./instruction";
import {
  AvailableSwapPools, CustomSwapParams, GetAmountOutReturn, GetBestAmountOutParams, RouteComputeAmountOutData,
  RouteComputeAmountOutParams, RouteInfo, RouteSwapInstructionParams, RouteSwapTransactionParams, RouteType, SwapParams,
} from "./type";
import { getAssociatedMiddleStatusAccount, groupPools } from "./util";

export default class Trade extends ModuleBase {
  public async load(): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchLiquidity();
  }

  private async _getBestPool({
    availablePools,
    officialPoolIdSet,
  }: {
    availablePools: ApiLiquidityPoolInfo[];
    officialPoolIdSet: Set<string>;
  }): Promise<ApiLiquidityPoolInfo | undefined> {
    if (availablePools.length === 0) return undefined;
    if (availablePools.length === 1) return availablePools[0];
    const officials = availablePools.filter((info) => officialPoolIdSet.has(info.id));
    if (officials.length === 1) return officials[0];
    const sameLevels = await this.scope.liquidity.sdkParseJsonLiquidityInfo(
      officials.length ? officials : availablePools,
    );
    // have most lp Supply
    const largest = sameLevels.reduce((acc, curr) => {
      const accIsStable = acc.version === 5;
      const currIsStable = curr.version === 5;
      if (accIsStable && !currIsStable) return acc;
      if (!accIsStable && currIsStable) return curr;
      return gte(div(acc.lpSupply, 10 ** acc.lpDecimals), div(curr.lpSupply, 10 ** curr.lpDecimals)) ? acc : curr;
    });
    return largest.jsonInfo;
  }

  private _computeRouteAmountOut({
    fromPoolKeys,
    toPoolKeys,
    fromPoolInfo,
    toPoolInfo,
    amountIn,
    outputToken,
    slippage,
  }: RouteComputeAmountOutParams): RouteComputeAmountOutData {
    const { swap: fromPoolSwapEnabled } = getPoolEnabledFeatures(fromPoolInfo);
    const { swap: toPoolSwapEnabled } = getPoolEnabledFeatures(toPoolInfo);
    if (!fromPoolSwapEnabled || !toPoolSwapEnabled)
      this.logAndCreateError("pools swap not enabled", "pools", {
        fromPoolKeys,
        toPoolKeys,
        fromPoolInfo,
        toPoolInfo,
      });

    const tokenIn = amountIn.token;
    const tokenOut = outputToken instanceof Token ? outputToken : Token.WSOL;

    if (!includesToken(tokenIn, fromPoolKeys) || !includesToken(tokenOut, toPoolKeys))
      this.logAndCreateError("pools cannot be routed", "pools", {
        fromPoolKeys,
        toPoolKeys,
      });

    const fromPoolMints = [fromPoolKeys.baseMint.toBase58(), fromPoolKeys.quoteMint.toBase58()];
    const toPoolMints = [toPoolKeys.baseMint.toBase58(), toPoolKeys.quoteMint.toBase58()];
    const mints = [...fromPoolMints, ...toPoolMints];
    const decimals = [
      fromPoolInfo.baseDecimals,
      fromPoolInfo.quoteDecimals,
      toPoolInfo.baseDecimals,
      toPoolInfo.quoteDecimals,
    ];
    const [mintIn, mintOut] = [tokenIn.mint.toBase58(), tokenOut.mint.toBase58()];

    const xorMints = xor(fromPoolMints, toPoolMints);
    if (xorMints.length !== 2 || xorMints.includes(mintIn) || xorMints.includes(mintOut))
      this.logAndCreateError("xor tokens not match", "pools", {
        fromPoolKeys,
        toPoolKeys,
      });

    const intersectionMints = intersection(fromPoolMints, toPoolMints);
    if (intersectionMints.length !== 1)
      this.logAndCreateError("cannot found middle token of two pools", "pools", {
        fromPoolKeys,
        toPoolKeys,
      });

    const _middleMint = intersectionMints[0];
    const index = mints.indexOf(_middleMint);
    if (index === -1)
      this.logAndCreateError("cannot found middle token", "pools", {
        fromPoolKeys,
        toPoolKeys,
      });

    const middleMintDecimals = decimals[index];
    const middleMint = new PublicKey(_middleMint);
    const middleToken = new Token({ mint: middleMint, decimals: middleMintDecimals });

    this.logDebug(`from pool:`, fromPoolKeys);
    this.logDebug("to pool:", toPoolKeys);
    this.logDebug("intersection mints:", intersectionMints);
    this.logDebug("xor mints:", xorMints);
    this.logDebug("middleMint:", _middleMint);

    const {
      minAmountOut: minMiddleAmountOut,
      priceImpact: firstPriceImpact,
      fee: firstFee,
    } = this.scope.liquidity.computeAmountOut({
      poolKeys: fromPoolKeys,
      poolInfo: fromPoolInfo,
      amountIn,
      outputToken: middleToken,
      slippage,
    });
    const {
      amountOut,
      minAmountOut,
      priceImpact: secondPriceImpact,
      fee: secondFee,
    } = this.scope.liquidity.computeAmountOut({
      poolKeys: toPoolKeys,
      poolInfo: toPoolInfo,
      amountIn: minMiddleAmountOut,
      outputToken,
      slippage,
    });

    let executionPrice: Price | null = null;
    const [amountInRaw, amountOutRaw] = [amountIn.raw, amountOut.raw];
    const currencyIn = amountIn.token;
    if (!amountInRaw.isZero() && !amountOutRaw.isZero()) {
      executionPrice = new Price({
        baseCurrency: currencyIn,
        denominator: amountInRaw,
        quoteCurrency: outputToken,
        numerator: amountOutRaw,
      });
      this.logDebug("executionPrice:", `1 ${currencyIn.symbol} ≈ ${executionPrice.toFixed()} ${outputToken.symbol}`);
      this.logDebug(
        "executionPrice invert:",
        `1 ${outputToken.symbol} ≈ ${executionPrice.invert().toFixed()} ${currencyIn.symbol}`,
      );
    }

    return {
      amountOut,
      minAmountOut,
      executionPrice,
      priceImpact: firstPriceImpact.add(secondPriceImpact),
      fee: [firstFee, secondFee],
    };
  }

  /* ================= make instruction and transaction ================= */
  private _makeSwapInstruction(params: RouteSwapInstructionParams): TransactionInstruction[] {
    const { fixedSide } = params;

    if (fixedSide === "in") {
      return [makeSwapInFixedInInstruction(params), makeSwapOutFixedInInstruction(params)];
    }

    this.logAndCreateError("invalid params", "params", params);
    throw new Error(`invalid params, params: ${params}`);
  }

  public async swapWithRoute(params: RouteSwapTransactionParams): Promise<MakeTransaction> {
    const { fromPoolKeys, toPoolKeys, amountIn, amountOut, fixedSide, config } = params;
    this.logDebug("amountIn:", amountIn, "amountOut:", amountOut);
    if (amountIn.isZero() || amountOut.isZero())
      this.logAndCreateError("amounts must greater than zero", "currencyAmounts", {
        amountIn: amountIn.toFixed(),
        amountOut: amountOut.toFixed(),
      });

    const { bypassAssociatedCheck = false } = config || {};
    // handle currency in & out (convert SOL to WSOL)
    const tokenIn = amountIn instanceof TokenAmount ? amountIn.token : Token.WSOL;
    const tokenOut = amountOut instanceof TokenAmount ? amountOut.token : Token.WSOL;

    const tokenAccountIn = await this.scope.account.getCreatedTokenAccount({
      mint: tokenIn.mint,
      associatedOnly: false,
    });
    const tokenAccountOut = await this.scope.account.getCreatedTokenAccount({
      mint: tokenOut.mint,
    });

    const fromPoolMints = [fromPoolKeys.baseMint.toBase58(), fromPoolKeys.quoteMint.toBase58()];
    const toPoolMints = [toPoolKeys.baseMint.toBase58(), toPoolKeys.quoteMint.toBase58()];
    const intersectionMints = intersection(fromPoolMints, toPoolMints);
    const _middleMint = intersectionMints[0];
    const middleMint = new PublicKey(_middleMint);
    const tokenAccountMiddle = await this.scope.account.getCreatedTokenAccount({
      mint: middleMint,
    });

    const [amountInRaw, amountOutRaw] = [amountIn.raw, amountOut.raw];

    const txBuilder = this.createTxBuilder();

    const { tokenAccount: _tokenAccountIn, ...accountInInstruction } = await this.scope.account.handleTokenAccount({
      side: "in",
      amount: amountInRaw,
      mint: tokenIn.mint,
      tokenAccount: tokenAccountIn,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(accountInInstruction);
    const { tokenAccount: _tokenAccountOut, ...accountOutInstruction } = await this.scope.account.handleTokenAccount({
      side: "out",
      amount: 0,
      mint: tokenOut.mint,
      tokenAccount: tokenAccountOut,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(accountOutInstruction);
    const { tokenAccount: _tokenAccountMiddle, ...accountMiddleInstruction } =
      await this.scope.account.handleTokenAccount({
        side: "in",
        amount: 0,
        mint: middleMint,
        tokenAccount: tokenAccountMiddle,
        bypassAssociatedCheck,
      });
    txBuilder.addInstruction(accountMiddleInstruction);
    txBuilder.addInstruction({
      instructions: this._makeSwapInstruction({
        fromPoolKeys,
        toPoolKeys,
        userKeys: {
          inTokenAccount: _tokenAccountIn,
          outTokenAccount: _tokenAccountOut,
          middleTokenAccount: _tokenAccountMiddle,
          middleStatusAccount: await getAssociatedMiddleStatusAccount({
            programId: ROUTE_PROGRAM_ID_V1,
            fromPoolId: fromPoolKeys.id,
            middleMint,
            owner: this.scope.ownerPubKey,
          }),
          owner: this.scope.ownerPubKey,
        },
        amountIn: amountInRaw,
        amountOut: amountOutRaw,
        fixedSide,
      }),
    });
    return await txBuilder.build();
  }

  public async getAvailablePools(params: { inputMint: PublicKey; outputMint: PublicKey }): Promise<AvailableSwapPools> {
    this.checkDisabled();
    const { inputMint, outputMint } = params;
    const [mintIn, mintOut] = [inputMint.toBase58(), outputMint.toBase58()];
    const availablePools = this.scope.liquidity.allPools.filter(
      (info) =>
        (info.baseMint === mintIn && info.quoteMint === mintOut) ||
        (info.baseMint === mintOut && info.quoteMint === mintIn),
    );

    const candidateTokenMintsSet = new Set([...swapRouteMiddleMints, mintIn, mintOut]); // list with swap tokens
    const routeOnlyMintsSet = new Set(JSON.parse(JSON.stringify([...candidateTokenMintsSet]))); // list without swap tokens
    routeOnlyMintsSet.delete(mintIn);
    routeOnlyMintsSet.delete(mintOut);
    const routedPools = this.scope.liquidity.allPools.filter((info) => {
      const isCandidate = candidateTokenMintsSet.has(info.baseMint) && candidateTokenMintsSet.has(info.quoteMint);
      const onlyInRoute = routeOnlyMintsSet.has(info.baseMint) && routeOnlyMintsSet.has(info.quoteMint);
      return isCandidate && !onlyInRoute;
    });

    const best = await this._getBestPool({
      availablePools,
      officialPoolIdSet: this.scope.liquidity.allPoolIdSet.official,
    });

    return { availablePools, best, routedPools };
  }

  /**
   * Get best amount out
   *
   * @param pools - pools to calculate best swap rate, if not passed, will find automatically - optional
   */
  public async getBestAmountOut({
    pools,
    amountIn,
    inputToken,
    outputToken,
    slippage,
    features,
  }: GetBestAmountOutParams): Promise<GetAmountOutReturn> {
    this.checkDisabled();
    if (!pools) {
      const { routedPools } = await this.getAvailablePools({
        inputMint: inputToken.mint,
        outputMint: outputToken.mint,
      });
      pools = routedPools;
    }
    const sdkParsedInfo = await this.scope.liquidity.sdkParseJsonLiquidityInfo(pools || []);
    const _pools = (pools || []).map((pool, idx) => ({
      poolKeys: jsonInfo2PoolKeys(pool),
      poolInfo: sdkParsedInfo[idx],
    }));
    const _features = features || defaultRoutes;
    this.logDebug("features:", _features);
    if (!_pools.length)
      this.logAndCreateError("please provide at least one source of trade or (inputMint & outputMint)", _pools);

    // the route of the trade
    let routes: RouteInfo[] = [];
    let routeType: RouteType = "amm";

    const _amountIn = new TokenAmount(inputToken, amountIn);
    // the output amount for the trade assuming no slippage
    let _amountOut = new TokenAmount(outputToken, 0);
    let _minAmountOut = _amountOut;

    let _currentPrice: Price | null = null;
    // the price expressed in terms of output amount/input amount
    let _executionPrice: Price | null = null;

    // the percent difference between the mid price before the trade and the trade execution price
    let _priceImpact = new Percent(BN_ZERO);
    let _fee: TokenAmount[] = [];

    // amm directly
    if (_features.includes("amm")) {
      for (const { poolKeys, poolInfo } of _pools) {
        // * if currencies not match with pool, will throw error
        try {
          const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } =
            this.scope.liquidity.computeAmountOut({
              poolKeys,
              poolInfo,
              amountIn: _amountIn,
              outputToken,
              slippage,
            });

          if (amountOut.gt(_amountOut)) {
            routes = [{ source: "amm", keys: poolKeys }];
            routeType = "amm";
            _amountOut = amountOut;
            _minAmountOut = minAmountOut;
            _currentPrice = currentPrice;
            _executionPrice = executionPrice;
            _priceImpact = priceImpact;
            _fee = [fee];
          }
        } catch (error) {
          this.logger.error(error);
        }
      }
    }

    // amm route
    if (_features.includes("route")) {
      const groupedPools = groupPools(_pools);

      for (const grouped of groupedPools) {
        if (grouped.length !== 2) continue;
        const { poolKeys: fromPoolKeys, poolInfo: fromPoolInfo } = grouped[0];
        const { poolKeys: toPoolKeys, poolInfo: toPoolInfo } = grouped[1];

        // * if currencies not match with pool, will throw error
        try {
          const { amountOut, minAmountOut, executionPrice, priceImpact, fee } = this._computeRouteAmountOut({
            fromPoolKeys,
            toPoolKeys,
            fromPoolInfo,
            toPoolInfo,
            amountIn: _amountIn,
            outputToken,
            slippage,
          });

          if (amountOut.gt(_amountOut)) {
            routes = [
              { source: "amm", keys: fromPoolKeys },
              { source: "amm", keys: toPoolKeys },
            ];
            routeType = "route";
            _amountOut = amountOut;
            _minAmountOut = minAmountOut;
            _executionPrice = executionPrice;
            _priceImpact = priceImpact;
            _fee = fee;
          }
        } catch (error) {
          this.logger.error(error);
        }
      }
    }

    return {
      routes,
      routeType,
      amountOut: _amountOut,
      minAmountOut: _minAmountOut,
      fixedSide: "in",
      currentPrice: _currentPrice,
      executionPrice: _executionPrice,
      priceImpact: _priceImpact,
      fee: _fee,
    };
  }

  public async swap(params: SwapParams): Promise<MakeTransaction> {
    this.checkDisabled();
    const { inputMint, outputMint, amountIn, slippage, config } = params;
    const inputToken = this.scope.token.mintToToken(inputMint);
    const outputToken = this.scope.token.mintToToken(outputMint);
    const { routes, routeType, minAmountOut } = await this.getBestAmountOut({
      inputToken,
      outputToken,
      amountIn,
      slippage,
    });

    return await this.routeSwap({
      routes,
      routeType,
      amountIn: new TokenAmount(inputToken, amountIn),
      amountOut: new TokenAmount(outputToken, minAmountOut.toSignificant()),
      fixedSide: "in",
      config,
    });
  }

  public async routeSwap(params: CustomSwapParams): Promise<MakeTransaction> {
    this.checkDisabled();
    this.scope.checkOwner();
    const { routes, routeType, amountIn, amountOut, fixedSide, config } = params;
    if (routeType === "amm" && routes.length === 1) {
      return await this.scope.liquidity.swapWithAMM({
        poolKeys: routes[0].keys,
        amountIn,
        amountOut,
        fixedSide,
        config,
      });
    } else if (routeType === "route" && routes.length === 2) {
      return await this.swapWithRoute({
        fromPoolKeys: routes[0].keys,
        toPoolKeys: routes[1].keys,
        amountIn,
        amountOut,
        fixedSide,
        config,
      });
    }
    this.logAndCreateError("invalid routes with routeType", "routes", {
      routeType,
      routes,
    });
    return await this.createTxBuilder().build();
  }
}
