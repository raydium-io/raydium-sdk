import { Connection, PublicKey } from "@solana/web3.js";

import { TokenAccount, UnsignedTransactionAndSigners } from "../base";
import { Logger } from "../common";
import { Currency, CurrencyAmount, Percent, Price, Token, TokenAmount, ZERO } from "../entity";
import { Liquidity, LiquidityPoolInfo, LiquidityPoolKeys, SwapSide } from "../liquidity";
import { Route } from "../route";

const logger = Logger.from("Trade");

export type TradeSource = "amm" | "serum" | "stable";

const defaultRoutes = ["amm", "serum", "route"];
export type RouteType = "amm" | "serum" | "route";

export interface RouteInfo {
  source: TradeSource;
  keys: LiquidityPoolKeys;
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

export interface TradeTransactionParams {
  connection: Connection;
  routes: RouteInfo[];
  routeType: RouteType;
  userKeys: {
    tokenAccounts: TokenAccount[];
    owner: PublicKey;
    payer?: PublicKey;
  };
  amountIn: CurrencyAmount | TokenAmount;
  amountOut: CurrencyAmount | TokenAmount;
  fixedSide: SwapSide;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}

export interface GetBestAmountOutParams {
  pools?: AmmSource[];
  markets?: SerumSource[];
  amountIn: CurrencyAmount | TokenAmount;
  currencyOut: Currency | Token;
  slippage: Percent;
  midTokens?: Currency | Token[];
  features?: RouteType[];
}

export interface GetBestAmountInParams extends Omit<GetBestAmountOutParams, "amountIn" | "currencyOut"> {
  amountOut: CurrencyAmount | TokenAmount;
  currencyIn: Currency | Token;
}

export class Trade {
  static groupPools(pools: AmmSource[]) {
    const grouped: AmmSource[][] = [];

    for (let index = 0; index < pools.length; index++) {
      for (let i = 0; i < pools.length; i++) {
        if (index == i) continue;
        grouped.push([pools[index], pools[i]]);
      }
    }
    return grouped;
  }

  static async makeTradeTransaction(params: TradeTransactionParams) {
    const { connection, routes, routeType, userKeys, amountIn, amountOut, fixedSide, config } = params;

    let setupTransaction: UnsignedTransactionAndSigners | null = null;
    let tradeTransaction: UnsignedTransactionAndSigners | null = null;
    // const cleanupTransaction: UnsignedTransactionAndSigners | null = null;

    if (routeType === "amm") {
      logger.assertArgument(routes.length === 1, "invalid routes with routeType", "routes", {
        routeType,
        routes,
      });

      const { keys } = routes[0];

      const { transaction, signers } = await Liquidity.makeSwapTransaction({
        connection,
        poolKeys: keys,
        userKeys,
        amountIn,
        amountOut,
        fixedSide,
        config,
      });

      tradeTransaction = { transaction, signers };
    } else if (routeType === "route") {
      logger.assertArgument(routes.length === 2, "invalid routes with routeType", "routes", {
        routeType,
        routes,
      });

      const [from, to] = routes;
      const { keys: fromPoolKeys } = from;
      const { keys: toPoolKeys } = to;

      const { setupTransaction: _setupTransaction, swapTransaction: _swapTransaction } =
        await Route.makeSwapTransaction({
          connection,
          fromPoolKeys,
          toPoolKeys,
          userKeys,
          amountIn,
          amountOut,
          fixedSide,
          config,
        });

      setupTransaction = _setupTransaction;
      tradeTransaction = _swapTransaction;
    }

    return {
      setupTransaction,
      tradeTransaction,
      // cleanupTransaction
    };
  }

  /**
   * Get best amount out
   *
   * @param params - {@link GetBestAmountOutParams}
   */
  static getBestAmountOut({ pools, markets, amountIn, currencyOut, slippage, features }: GetBestAmountOutParams) {
    const _pools = pools || [];
    const _markets = markets || [];
    const _features = features || defaultRoutes;
    logger.debug("features:", _features);

    logger.assertArgument(
      _pools.length !== 0 || _markets.length !== 0,
      "must provide at least one source of trade",
      "pools, markets",
      { pools, markets },
    );

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

    // the mid price after the trade executes assuming no slippage
    // const nextMidPrice =

    // the percent difference between the mid price before the trade and the trade execution price
    let _priceImpact = new Percent(ZERO);
    let _fee: CurrencyAmount[] = [];

    // amm directly
    if (_features.includes("amm")) {
      for (const { poolKeys, poolInfo } of _pools) {
        // * if currencies not match with pool, will throw error
        try {
          const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } =
            Liquidity.computeAmountOut({
              poolKeys,
              poolInfo,
              amountIn,
              currencyOut,
              slippage,
            });

          if (amountOut.gt(_amountOut)) {
            routes = [
              {
                source: "amm",
                keys: poolKeys,
              },
            ];
            routeType = "amm";
            _amountOut = amountOut;
            _minAmountOut = minAmountOut;
            _currentPrice = currentPrice;
            _executionPrice = executionPrice;
            _priceImpact = priceImpact;
            _fee = [fee];
          }
        } catch (error) {
          //
        }
      }
    }

    // amm route
    if (_features.includes("route")) {
      const groupedPools = this.groupPools(_pools);

      for (const grouped of groupedPools) {
        if (grouped.length !== 2) continue;

        const [from, to] = grouped;
        const { poolKeys: fromPoolKeys, poolInfo: fromPoolInfo } = from;
        const { poolKeys: toPoolKeys, poolInfo: toPoolInfo } = to;

        // * if currencies not match with pool, will throw error
        try {
          const { amountOut, minAmountOut, executionPrice, priceImpact, fee } = Route.computeAmountOut({
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
              {
                source: "amm",
                keys: fromPoolKeys,
              },
              {
                source: "amm",
                keys: toPoolKeys,
              },
            ];
            routeType = "route";
            _amountOut = amountOut;
            _minAmountOut = minAmountOut;
            _executionPrice = executionPrice;
            _priceImpact = priceImpact;
            _fee = fee;
          }
        } catch (error) {
          //
        }
      }
    }

    // serum directly
    // amm route
    // stable

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

  /**
   * Get best amount in
   *
   * @param params - {@link GetBestAmountInParams}
   */
  static getBestAmountIn({ pools, markets, amountOut, currencyIn, slippage, features }: GetBestAmountInParams) {
    const _pools = pools || [];
    const _markets = markets || [];
    const _features = features || defaultRoutes;
    logger.debug("features:", _features);

    logger.assertArgument(
      _pools.length !== 0 || _markets.length !== 0,
      "must provide at least one source of trade",
      "pools, markets",
      { pools, markets },
    );

    let routes: RouteInfo[] = [];
    let routeType: RouteType = "amm";

    let _amountIn = currencyIn instanceof Token ? new TokenAmount(currencyIn, 0) : new CurrencyAmount(currencyIn, 0);
    let _maxAmountIn = _amountIn;

    let _currentPrice: Price | null = null;
    let _executionPrice: Price | null = null;
    let _priceImpact = new Percent(ZERO);

    // amm directly
    if (_features.includes("amm")) {
      for (const { poolKeys, poolInfo } of _pools) {
        const { amountIn, maxAmountIn, currentPrice, executionPrice, priceImpact } = Liquidity.computeAmountIn({
          poolKeys,
          poolInfo,
          amountOut,
          currencyIn,
          slippage,
        });

        if (amountIn.lt(_amountIn) || _amountIn.isZero()) {
          routes = [
            {
              source: "amm",
              keys: poolKeys,
            },
          ];
          routeType = "amm";
          _amountIn = amountIn;
          _maxAmountIn = maxAmountIn;
          _currentPrice = currentPrice;
          _executionPrice = executionPrice;
          _priceImpact = priceImpact;
        }
      }
    }

    return {
      routes,
      routeType,
      amountIn: _amountIn,
      maxAmountIn: _maxAmountIn,
      currentPrice: _currentPrice,
      executionPrice: _executionPrice,
      priceImpact: _priceImpact,
    };
  }
}
