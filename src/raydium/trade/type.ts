import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { ApiLiquidityPoolInfo } from "../../api/type";
import { BigNumberish } from "../../common/bignumber";
import { Currency, CurrencyAmount, Fraction, Percent, Price, Token, TokenAmount } from "../../module";
import { LiquidityPoolInfo, LiquidityPoolKeys, SerumSource, SwapSide } from "../liquidity/type";

export type TradeSource = "amm" | "serum" | "stable";
export type RouteType = "amm" | "serum" | "route";

export interface RouteInfo {
  source: TradeSource;
  keys: LiquidityPoolKeys;
}

export interface GetBestAmountOutParams {
  pools?: ApiLiquidityPoolInfo[];
  markets?: SerumSource[];
  inputToken: Token;
  outputToken: Token;
  amountIn: BN;
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

export interface AvailableSwapPools {
  availablePools: ApiLiquidityPoolInfo[];
  best?: ApiLiquidityPoolInfo;
  routedPools: ApiLiquidityPoolInfo[];
}

export interface RouteComputeAmountOutParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  fromPoolInfo: LiquidityPoolInfo;
  toPoolInfo: LiquidityPoolInfo;
  amountIn: TokenAmount;
  outputToken: Token;
  slippage: Percent;
}

export interface RouteComputeAmountOutData {
  amountOut: TokenAmount;
  minAmountOut: TokenAmount;
  executionPrice: Price | null;
  priceImpact: Fraction;
  fee: TokenAmount[];
}

export interface SwapParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  payer?: PublicKey;
  amountIn: BN;
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
