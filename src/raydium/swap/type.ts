import { ApiLiquidityPoolInfo } from "../../api/type";
import { Currency, CurrencyAmount, Percent, Price, Token, TokenAmount } from "../../module";
import { LiquidityPoolInfo, LiquidityPoolKeys, SerumSource } from "../liquidity/type";

export type TradeSource = "amm" | "serum" | "stable";
export type RouteType = "amm" | "serum" | "route";

export interface RouteInfo {
  source: TradeSource;
  keys: LiquidityPoolKeys;
}

export interface GetBestAmountOutParams {
  pools?: ApiLiquidityPoolInfo[];
  markets?: SerumSource[];
  amountIn: CurrencyAmount | TokenAmount;
  currencyOut: Currency | Token;
  slippage: Percent;
  midTokens?: Currency | Token[];
  features?: RouteType[];
}

export interface GetAmountOutReturn {
  routes: RouteInfo[];
  routeType: "amm" | "route";
  amountOut: CurrencyAmount;
  minAmountOut: CurrencyAmount;
  fixedSide: "in";
  currentPrice: Price | null;
  executionPrice: Price | null;
  priceImpact: Percent;
  fee: CurrencyAmount[];
}

export interface AvailableSwapPools {
  availablePools: ApiLiquidityPoolInfo[];
  best?: ApiLiquidityPoolInfo;
  routeRelated: ApiLiquidityPoolInfo[];
}

export interface RouteComputeAmountOutParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  fromPoolInfo: LiquidityPoolInfo;
  toPoolInfo: LiquidityPoolInfo;
  amountIn: CurrencyAmount | TokenAmount;
  currencyOut: Currency | Token;
  slippage: Percent;
}
