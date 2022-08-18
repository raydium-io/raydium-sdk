import { PublicKey } from "@solana/web3.js";

import { BigNumberish } from "../../common/bignumber";
import { Fraction, Percent, Price, Token, TokenAmount } from "../../module";
import { LiquidityPoolInfo, LiquidityPoolKeys, SwapSide } from "../liquidity/type";

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

export interface RouteSwapTransactionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  amountIn: TokenAmount;
  amountOut: TokenAmount;
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

export interface RouteSwapInFixedInInstructionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  userKeys: Omit<RouteUserKeys, "outTokenAccount">;
  amountIn: BigNumberish;
  amountOut: BigNumberish;
}

export interface RouteSwapInstructionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  userKeys: RouteUserKeys;
  amountIn: BigNumberish;
  amountOut: BigNumberish;
  fixedSide: SwapSide;
}

export interface RouteSwapOutFixedInInstructionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  userKeys: Omit<RouteUserKeys, "inTokenAccount">;
}
