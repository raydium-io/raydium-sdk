import { Logger } from "../common";
import { Currency, CurrencyAmount, Percent, Token, TokenAmount, ZERO } from "../entity";
import { Liquidity, LiquidityPoolInfo, LiquidityPoolKeys } from "../liquidity";

const logger = Logger.from("Trade");

export type TradeSource = "amm" | "serum" | "amm-routing";
export interface Route {
  source: TradeSource;
  currencyAmountIn: CurrencyAmount | TokenAmount;
  currencyAmountOut: CurrencyAmount | TokenAmount;
}

export interface GetBestAmountOutParams {
  pools?: {
    poolKeys: LiquidityPoolKeys;
    poolInfo: LiquidityPoolInfo;
  }[];
  markets?: {
    marketKeys: [];
    bids: [];
    asks: [];
  }[];
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
    const _features = features || ["amm", "serum", "amm-routing"];
    logger.debug("features:", _features);

    logger.assertArgument(
      _pools.length !== 0 || _markets.length !== 0,
      "must provide at least one source of trade",
      "pools, markets",
      { pools, markets },
    );

    // the route of the trade
    const route: Route[] = [];

    // the output amount for the trade assuming no slippage
    let currencyAmountOut =
      currencyOut instanceof Token ? new TokenAmount(currencyOut, 0) : new CurrencyAmount(currencyOut, 0);
    let minCurrencyAmountOut = currencyAmountOut;

    // the price expressed in terms of output amount/input amount
    // const executionPrice
    // the mid price after the trade executes assuming no slippage
    // const nextMidPrice =
    // the percent difference between the mid price before the trade and the trade execution price
    let _priceImpact = new Percent(ZERO);

    // amm directly
    if (_features.includes("amm")) {
      for (const { poolKeys, poolInfo } of _pools) {
        const { amountOut, minAmountOut, priceImpact } = Liquidity.computeCurrencyAmountOut({
          poolKeys,
          poolInfo,
          currencyAmountIn,
          currencyOut,
          slippage,
        });

        if (amountOut.gt(currencyAmountOut)) {
          currencyAmountOut = amountOut;
          minCurrencyAmountOut = minAmountOut;
          _priceImpact = priceImpact;
        }
      }
    }

    return {
      route,
      currencyAmountOut,
      minCurrencyAmountOut,
      priceImpact: _priceImpact,
    };

    // serum directly
    // amm routing
    // stable
  }

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

    const route: Route[] = [];

    let currencyAmountIn =
      currencyIn instanceof Token ? new TokenAmount(currencyIn, 0) : new CurrencyAmount(currencyIn, 0);
    let maxCurrencyAmountIn = currencyAmountIn;

    let _priceImpact = new Percent(ZERO);

    // amm directly
    if (_features.includes("amm")) {
      for (const { poolKeys, poolInfo } of _pools) {
        const { amountIn, maxAmountIn, priceImpact } = Liquidity.computeCurrencyAmountIn({
          poolKeys,
          poolInfo,
          currencyAmountOut,
          currencyIn,
          slippage,
        });

        if (amountIn.lt(currencyAmountIn) || currencyAmountIn.isZero()) {
          currencyAmountIn = amountIn;
          maxCurrencyAmountIn = maxAmountIn;
          _priceImpact = priceImpact;
        }
      }
    }

    return {
      route,
      currencyAmountIn,
      maxCurrencyAmountIn,
      priceImpact: _priceImpact,
    };
  }
}
