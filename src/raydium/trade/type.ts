import { PublicKey } from "@solana/web3.js";

import { BigNumberish } from "../../common/bignumber";
import { Currency, Percent, Price, Token, TokenAmount } from "../../module";
import { LiquidityPoolJsonInfo, LiquidityPoolKeys, SerumSource, SwapSide } from "../liquidity/type";

export type TradeSource = "amm" | "serum" | "stable";
export type RouteType = "amm" | "serum" | "route";

export interface RouteInfo {
  source: TradeSource;
  keys: LiquidityPoolKeys;
}

export interface GetBestAmountOutParams {
  pools?: LiquidityPoolJsonInfo[];
  markets?: SerumSource[];
  inputToken: Token;
  outputToken: Token;
  amountIn: BigNumberish;
  slippage: Percent;
  midTokens?: Currency | Token[];
  features?: RouteType[];
}

export interface GetAmountOutReturn {
  routes: RouteInfo[];
  routeType: "amm" | "route";
  amountOut: TokenAmount;
  minAmountOut: TokenAmount;
  fixedSide: "in";
  currentPrice: Price | null;
  executionPrice: Price | null;
  priceImpact: Percent;
  fee: TokenAmount[];
}

export interface SwapParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  payer?: PublicKey;
  amountIn: BigNumberish;
  fixedSide: SwapSide;
  slippage: Percent;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}

export interface CustomSwapParams {
  routes: RouteInfo[];
  routeType: RouteType;
  payer?: PublicKey;
  amountIn: TokenAmount;
  amountOut: TokenAmount;
  fixedSide: SwapSide;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}

export interface AvailableSwapPools {
  availablePools: LiquidityPoolJsonInfo[];
  best?: LiquidityPoolJsonInfo;
  routedPools: LiquidityPoolJsonInfo[];
}
