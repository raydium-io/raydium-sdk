import { Connection, PublicKey, Signer, Transaction } from "@solana/web3.js";

import { TokenAccount } from "../base";
import { Logger } from "../common";
import { Currency, CurrencyAmount, Percent, Price, Token, TokenAmount, ZERO } from "../entity";
import { Liquidity, LiquidityPoolInfo, LiquidityPoolKeys, SwapSide } from "../liquidity";

const logger = Logger.from("Trade");

export type TradeSource = "amm" | "serum" | "amm-route";

export interface TradeRoute {
  source: TradeSource;
  poolKeys: LiquidityPoolKeys;
  amountIn: CurrencyAmount | TokenAmount;
  amountOut: CurrencyAmount | TokenAmount;
  fixedSide: SwapSide;
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

export interface UnsignedTransactionAndSigners {
  transaction: Transaction;
  signers: Signer[];
}

export interface TradeTransactionParams {
  connection: Connection;
  routes: TradeRoute[];
  userKeys: {
    tokenAccounts: TokenAccount[];
    owner: PublicKey;
    payer?: PublicKey;
  };
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
  features?: TradeSource[];
}

export interface GetBestAmountInParams extends Omit<GetBestAmountOutParams, "amountIn" | "currencyOut"> {
  amountOut: CurrencyAmount | TokenAmount;
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

  static async makeTradeTransaction(params: TradeTransactionParams) {
    const { connection, routes, userKeys, config } = params;

    let transactions: UnsignedTransactionAndSigners[] = [];

    for (const route of routes) {
      const { source, poolKeys, amountIn, amountOut, fixedSide } = route;

      if (source === "amm") {
        const { transaction, signers } = await Liquidity.makeSwapTransaction({
          connection,
          poolKeys,
          userKeys,
          amountIn,
          amountOut,
          fixedSide,
          config,
        });

        transactions = [{ transaction, signers }];
      }
    }

    return transactions;
  }

  /**
   * Get best amount out
   *
   * @param params - {@link GetBestAmountOutParams}
   */
  static getBestAmountOut({ pools, markets, amountIn, currencyOut, slippage, features }: GetBestAmountOutParams) {
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
    let routes: TradeRoute[] = [];

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

    // amm directly
    if (_features.includes("amm")) {
      for (const { poolKeys, poolInfo } of _pools) {
        // * if currencies not match with pool, will throw error
        try {
          const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact } = Liquidity.computeAmountOut({
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
                poolKeys,
                amountIn,
                amountOut: minAmountOut,
                fixedSide: "in",
              },
            ];
            _amountOut = amountOut;
            _minAmountOut = minAmountOut;
            _currentPrice = currentPrice;
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
      amountOut: _amountOut,
      minAmountOut: _minAmountOut,
      currentPrice: _currentPrice,
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
  static getBestAmountIn({ pools, markets, amountOut, currencyIn, slippage, features }: GetBestAmountInParams) {
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

    let routes: TradeRoute[] = [];

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
              poolKeys,
              amountIn: maxAmountIn,
              amountOut,
              fixedSide: "out",
            },
          ];
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
      amountIn: _amountIn,
      maxAmountIn: _maxAmountIn,
      currentPrice: _currentPrice,
      executionPrice: _executionPrice,
      priceImpact: _priceImpact,
    };
  }
}
