import { Logger } from "../common";
import { Currency, CurrencyAmount, Percent, Price, Token, TokenAmount, ZERO } from "../entity";
import { Liquidity, LiquidityPoolInfo, LiquidityPoolKeys } from "../liquidity";

const logger = Logger.from("Trade");

export type TradeSource = "amm" | "serum" | "amm-route";
export interface TradeRoute {
  source: TradeSource;
  currencyAmountIn: CurrencyAmount | TokenAmount;
  currencyAmountOut: CurrencyAmount | TokenAmount;
}

export interface AmmSource {
  poolKeys: LiquidityPoolKeys;
  poolInfo: LiquidityPoolInfo;
}

export interface SerumSource {
  marketKeys: [];
  bids: [];
  asks: [];
}

export interface GetBestAmountOutParams {
  pools?: AmmSource[];
  markets?: SerumSource[];
  currencyAmountIn: CurrencyAmount | TokenAmount;
  currencyOut: Currency | Token;
  slippage: Percent;
  midTokens?: Currency | Token[];
  features?: TradeSource[];
}

export interface GetBestAmountInParams extends Omit<GetBestAmountOutParams, "currencyAmountIn" | "currencyOut"> {
  currencyAmountOut: CurrencyAmount | TokenAmount;
  currencyIn: Currency | Token;
}

export class Trade {
  static groupPools(pools: AmmSource[]) {
    const grouped: AmmSource[][] = [];

    for (let index = 0; index < pools.length; index++) {
      for (let i = index + 1; i < pools.length; i++) {
        grouped.push([pools[index], pools[i]]);
      }
    }

    return grouped;
  }

  /**
   * Get best amount out
   *
   * @param params - {@link GetBestAmountOutParams}
   */
  static getBestAmountOut({
    pools,
    markets,
    currencyAmountIn,
    currencyOut,
    slippage,
    features,
  }: GetBestAmountOutParams) {
    const _pools = pools || [];
    const _markets = markets || [];
    const _features = features || ["amm", "serum", "amm-route"];
    logger.debug("features:", _features);

    logger.assertArgument(
      _pools.length !== 0 || _markets.length !== 0,
      "must provide at least one source of trade",
      "pools, markets",
      { pools, markets },
    );

    // the route of the trade
    const routes: TradeRoute[] = [];

    // the output amount for the trade assuming no slippage
    let currencyAmountOut =
      currencyOut instanceof Token ? new TokenAmount(currencyOut, 0) : new CurrencyAmount(currencyOut, 0);
    let minCurrencyAmountOut = currencyAmountOut;

    // the price expressed in terms of output amount/input amount
    let _executionPrice: Price | null = null;
    // the mid price after the trade executes assuming no slippage
    // const nextMidPrice =
    // the percent difference between the mid price before the trade and the trade execution price
    let _priceImpact = new Percent(ZERO);

    // amm directly
    if (_features.includes("amm")) {
      for (const { poolKeys, poolInfo } of _pools) {
        // * if currencies not match with pool, will throw error
        try {
          const { amountOut, minAmountOut, executionPrice, priceImpact } = Liquidity.computeCurrencyAmountOut({
            poolKeys,
            poolInfo,
            currencyAmountIn,
            currencyOut,
            slippage,
          });

          if (amountOut.gt(currencyAmountOut)) {
            currencyAmountOut = amountOut;
            minCurrencyAmountOut = minAmountOut;
            _executionPrice = executionPrice;
            _priceImpact = priceImpact;
          }
        } catch (error) {
          //
        }
      }
    }

    return {
      routes,
      currencyAmountOut,
      minCurrencyAmountOut,
      executionPrice: _executionPrice,
      priceImpact: _priceImpact,
    };

    // serum directly
    // amm route
    // stable
  }

  /**
   * Get best amount in
   *
   * @param params - {@link GetBestAmountInParams}
   */
  static getBestAmountIn({ pools, markets, currencyAmountOut, currencyIn, slippage, features }: GetBestAmountInParams) {
    const _pools = pools || [];
    const _markets = markets || [];
    const _features = features || ["amm", "serum", "amm-routing"];
    logger.debug("features:", _features);

    logger.assertArgument(
      _pools.length !== 0 || _markets.length !== 0,
      "must provide at least one source of trade",
      "pools, markets",
      { pools, markets },
    );

    const routes: TradeRoute[] = [];

    let currencyAmountIn =
      currencyIn instanceof Token ? new TokenAmount(currencyIn, 0) : new CurrencyAmount(currencyIn, 0);
    let maxCurrencyAmountIn = currencyAmountIn;

    let _executionPrice: Price | null = null;
    let _priceImpact = new Percent(ZERO);

    // amm directly
    if (_features.includes("amm")) {
      for (const { poolKeys, poolInfo } of _pools) {
        const { amountIn, maxAmountIn, executionPrice, priceImpact } = Liquidity.computeCurrencyAmountIn({
          poolKeys,
          poolInfo,
          currencyAmountOut,
          currencyIn,
          slippage,
        });

        if (amountIn.lt(currencyAmountIn) || currencyAmountIn.isZero()) {
          currencyAmountIn = amountIn;
          maxCurrencyAmountIn = maxAmountIn;
          _executionPrice = executionPrice;
          _priceImpact = priceImpact;
        }
      }
    }

    return {
      routes,
      currencyAmountIn,
      maxCurrencyAmountIn,
      executionPrice: _executionPrice,
      priceImpact: _priceImpact,
    };
  }
}
