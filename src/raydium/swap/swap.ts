import { PublicKey } from "@solana/web3.js";
import { intersection, xor } from "lodash";

import { ApiLiquidityPoolInfo } from "../../api/type";
import { BN_ZERO } from "../../common/bignumber";
import { div, gte } from "../../common/fractionUtil";
import { jsonInfo2PoolKeys } from "../../common/utility";
import { CurrencyAmount, Percent, Price, Token, TokenAmount } from "../../module";
import { getPoolEnabledFeatures, includesToken } from "../liquidity/util";
import ModuleBase from "../moduleBase";
import { RouteType } from "../swap/type";

import { defaultRoutes, swapRouteMiddleMints } from "./constant";
import {
  AvailableSwapPools,
  GetAmountOutReturn,
  GetBestAmountOutParams,
  RouteComputeAmountOutParams,
  RouteInfo,
} from "./type";
import { groupPools } from "./util";

export default class Swap extends ModuleBase {
  public async load(): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchLiquidity();
  }

  public async getAvailablePools(params: {
    currencyInMint: PublicKey;
    currencyOutMint: PublicKey;
  }): Promise<AvailableSwapPools> {
    const { currencyInMint, currencyOutMint } = params;
    const [mintIn, mintOut] = [currencyInMint.toBase58(), currencyOutMint.toBase58()];
    const availablePools = this.scope.liquidity.allPools.filter(
      (info) =>
        (info.baseMint === mintIn && info.quoteMint === mintOut) ||
        (info.baseMint === mintOut && info.quoteMint === mintIn),
    );

    const routeMiddleSet = new Set([...swapRouteMiddleMints, mintIn, mintOut]);
    const candidateTokenMints = Array.from(routeMiddleSet); // list with swap tokens
    routeMiddleSet.delete(mintIn);
    routeMiddleSet.delete(mintOut);
    const routeOnlyMints = Array.from(routeMiddleSet); // list without swap tokens
    const routeRelated = this.scope.liquidity.allPools.filter((info) => {
      const isCandidate = candidateTokenMints.includes(info.baseMint) && candidateTokenMints.includes(info.quoteMint);
      const onlyInRoute = routeOnlyMints.includes(info.baseMint) && routeOnlyMints.includes(info.quoteMint);
      return isCandidate && !onlyInRoute;
    });

    const best = await this.getBestPool({
      availablePools,
      officialPoolIdSet: this.scope.liquidity.allPoolIdSet.official,
    });

    return { availablePools, best, routeRelated };
  }

  public async getBestPool({
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

  public computeRouteAmountOut({
    fromPoolKeys,
    toPoolKeys,
    fromPoolInfo,
    toPoolInfo,
    amountIn,
    currencyOut,
    slippage,
  }: RouteComputeAmountOutParams): any {
    const { swap: fromPoolSwapEnabled } = getPoolEnabledFeatures(fromPoolInfo);
    const { swap: toPoolSwapEnabled } = getPoolEnabledFeatures(toPoolInfo);
    if (!fromPoolSwapEnabled || !toPoolSwapEnabled)
      this.logAndCreateError("pools swap not enabled", "pools", {
        fromPoolKeys,
        toPoolKeys,
        fromPoolInfo,
        toPoolInfo,
      });

    const tokenIn = amountIn instanceof TokenAmount ? amountIn.token : Token.WSOL;
    const tokenOut = currencyOut instanceof Token ? currencyOut : Token.WSOL;

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
    const mintIn = tokenIn.mint.toBase58();
    const mintOut = tokenOut.mint.toBase58();

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

    this.logger.debug("from pool:", fromPoolKeys);
    this.logger.debug("to pool:", toPoolKeys);
    this.logger.debug("intersection mints:", intersectionMints);
    this.logger.debug("xor mints:", xorMints);
    this.logger.debug("middleMint:", _middleMint);

    const {
      minAmountOut: minMiddleAmountOut,
      priceImpact: firstPriceImpact,
      fee: firstFee,
    } = this.scope.liquidity.computeAmountOut({
      poolKeys: fromPoolKeys,
      poolInfo: fromPoolInfo,
      amountIn,
      currencyOut: middleToken,
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
      currencyOut,
      slippage,
    });

    let executionPrice: Price | null = null;
    const [amountInRaw, amountOutRaw] = [amountIn.raw, amountOut.raw];
    const currencyIn = amountIn instanceof TokenAmount ? amountIn.token : amountIn.currency;
    if (!amountInRaw.isZero() && !amountOutRaw.isZero()) {
      executionPrice = new Price({
        baseCurrency: currencyIn,
        denominator: amountInRaw,
        quoteCurrency: currencyOut,
        numerator: amountOutRaw,
      });
      this.logger.debug(
        "executionPrice:",
        `1 ${currencyIn.symbol} ≈ ${executionPrice.toFixed()} ${currencyOut.symbol}`,
      );
      this.logger.debug(
        "executionPrice invert:",
        `1 ${currencyOut.symbol} ≈ ${executionPrice.invert().toFixed()} ${currencyIn.symbol}`,
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

  public async getBestAmountOut({
    pools,
    amountIn,
    currencyOut,
    slippage,
    features,
  }: GetBestAmountOutParams): Promise<GetAmountOutReturn> {
    const sdkParsedInfo = await this.scope.liquidity.sdkParseJsonLiquidityInfo(pools || []);
    const _pools = (pools || []).map((pool, idx) => ({
      poolKeys: jsonInfo2PoolKeys(pool),
      poolInfo: sdkParsedInfo[idx],
    }));
    const _features = features || defaultRoutes;
    this.logger.debug("features:", _features);
    if (!_pools.length) this.logAndCreateError("must provide at least one source of trade", _pools);

    // the route of the trade
    let routes: RouteInfo[] = [];
    let routeType: RouteType = "amm";

    // the output amount for the trade assuming no slippage
    let _amountOut =
      currencyOut instanceof Token ? new TokenAmount(currencyOut, 0) : new CurrencyAmount(currencyOut, 0);
    let _minAmountOut = _amountOut;

    let _currentPrice: Price | null = null;
    // the price expressed in terms of output amount/input amount
    let _executionPrice: Price | null = null;

    // the percent difference between the mid price before the trade and the trade execution price
    let _priceImpact = new Percent(BN_ZERO);
    let _fee: CurrencyAmount[] = [];

    // amm directly
    if (_features.includes("amm")) {
      for (const { poolKeys, poolInfo } of _pools) {
        // * if currencies not match with pool, will throw error
        try {
          const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } =
            this.scope.liquidity.computeAmountOut({
              poolKeys,
              poolInfo,
              amountIn,
              currencyOut,
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
          const { amountOut, minAmountOut, executionPrice, priceImpact, fee } = this.computeRouteAmountOut({
            fromPoolKeys,
            toPoolKeys,
            fromPoolInfo,
            toPoolInfo,
            amountIn,
            currencyOut,
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
}
