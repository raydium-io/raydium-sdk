import { BN_ZERO, parseBigNumberish } from "../../common/bignumber";
import { div, gte } from "../../common/fractionUtil";
import { validateAndParsePublicKey } from "../../common/pubKey";
import { jsonInfo2PoolKeys } from "../../common/utility";
import { Percent, Price, TokenAmount } from "../../module";
import { LiquidityPoolJsonInfo } from "../liquidity/type";
import ModuleBase from "../moduleBase";
import { defaultRoutes, swapRouteMiddleMints } from "../route/constant";
import { MakeTransaction } from "../type";

import {
  AvailableSwapPools, CustomSwapParams, GetAmountOutReturn, GetBestAmountOutParams, RouteInfo, RouteType, SwapParams,
} from "./type";
import { groupPools } from "./util";

export default class Trade extends ModuleBase {
  public async load(): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchLiquidity();
  }

  private async _getBestSwapPool({
    availablePools,
    officialPoolIdSet,
  }: {
    availablePools: LiquidityPoolJsonInfo[];
    officialPoolIdSet: Set<string>;
  }): Promise<LiquidityPoolJsonInfo | undefined> {
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

  public async getAvailablePools(params: { inputMint: string; outputMint: string }): Promise<AvailableSwapPools> {
    this.checkDisabled();
    const { inputMint, outputMint } = params;
    const [mintIn, mintOut] = [
      validateAndParsePublicKey(inputMint).toBase58(),
      validateAndParsePublicKey(outputMint).toBase58(),
    ];
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

    const best = await this._getBestSwapPool({
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
        inputMint: inputToken.mint.toBase58(),
        outputMint: outputToken.mint.toBase58(),
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
          const { amountOut, minAmountOut, executionPrice, priceImpact, fee } = this.scope.route.computeRouteAmountOut({
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

  public async directSwap(params: SwapParams): Promise<MakeTransaction> {
    this.checkDisabled();
    const { inputMint, outputMint, amountIn, slippage, config } = params;
    const inputToken = this.scope.token.mintToToken(inputMint);
    const outputToken = this.scope.token.mintToToken(outputMint);
    const { routes, routeType, minAmountOut } = await this.getBestAmountOut({
      inputToken,
      outputToken,
      amountIn: parseBigNumberish(amountIn),
      slippage,
    });

    return await this.swap({
      routes,
      routeType,
      amountIn: new TokenAmount(inputToken, amountIn),
      amountOut: new TokenAmount(outputToken, minAmountOut.toSignificant()),
      fixedSide: "in",
      config,
    });
  }

  public async swap(params: CustomSwapParams): Promise<MakeTransaction> {
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
      return await this.scope.route.swapWithRoute({
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
