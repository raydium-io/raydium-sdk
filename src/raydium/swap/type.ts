import { PublicKey } from "@solana/web3.js";

import { ApiLiquidityPoolInfo } from "../../api/type";
import { BigNumberish } from "../../common/bignumber";
import { Currency, CurrencyAmount, Percent, Price, Token, TokenAmount } from "../../module";
import { LiquidityPoolInfo, LiquidityPoolKeys, SerumSource, SwapSide } from "../liquidity/type";

export type TradeSource = "amm" | "serum" | "stable";
export type RouteType = "amm" | "serum" | "route";

export interface RouteInfo {
  source: TradeSource;
  keys: LiquidityPoolKeys;
}

export interface GetBestAmountOutParams {
  inputMint?: PublicKey;
  outputMint?: PublicKey;
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

export interface TradeParams {
  routes: RouteInfo[];
  routeType: RouteType;
  payer?: PublicKey;
  amountIn: CurrencyAmount | TokenAmount;
  amountOut: CurrencyAmount | TokenAmount;
  fixedSide: SwapSide;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}

export interface RouteSwapTransactionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  amountIn: CurrencyAmount | TokenAmount;
  amountOut: CurrencyAmount | TokenAmount;
  fixedSide: SwapSide;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}

export interface RouteUserKeys {
  inTokenAccount: PublicKey;
  outTokenAccount: PublicKey;
  middleTokenAccount: PublicKey;
  middleStatusAccount: PublicKey;
  owner: PublicKey;
}

export interface RouteSwapInstructionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  userKeys: RouteUserKeys;
  amountIn: BigNumberish;
  amountOut: BigNumberish;
  fixedSide: SwapSide;
}

export interface RouteSwapInFixedInInstructionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  userKeys: Omit<RouteUserKeys, "outTokenAccount">;
  amountIn: BigNumberish;
  amountOut: BigNumberish;
}

export interface RouteSwapOutFixedInInstructionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  userKeys: Omit<RouteUserKeys, "inTokenAccount">;
}
