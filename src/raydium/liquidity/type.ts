import { Commitment, PublicKey, Signer, Transaction } from "@solana/web3.js";
import BN from "bn.js";

import { ApiLiquidityPoolInfo } from "../../api/type";
import { BigNumberish } from "../../common/bignumber";
import { Currency, CurrencyAmount, Percent, Price, Token, TokenAmount } from "../../module";
import { ReplaceType } from "../type";

/* ================= pool keys ================= */
export type LiquidityPoolKeysV4 = {
  [T in keyof ApiLiquidityPoolInfo]: string extends ApiLiquidityPoolInfo[T] ? PublicKey : ApiLiquidityPoolInfo[T];
};

export type SwapSide = "in" | "out";
export type AmountSide = "base" | "quote";
/**
 * Full liquidity pool keys that build transaction need
 */
export type LiquidityPoolKeys = LiquidityPoolKeysV4;

export interface LiquidityPoolInfo {
  status: BN;
  baseDecimals: number;
  quoteDecimals: number;
  lpDecimals: number;
  baseReserve: BN;
  quoteReserve: BN;
  lpSupply: BN;
  startTime: BN;
}

export type SDKParsedLiquidityInfo = ReplaceType<ApiLiquidityPoolInfo, string, PublicKey> & {
  jsonInfo: ApiLiquidityPoolInfo;
  status: BN;
  baseDecimals: number;
  quoteDecimals: number;
  lpDecimals: number;
  baseReserve: BN;
  quoteReserve: BN;
  lpSupply: BN;
  startTime: BN;
};

export interface AmmSource {
  poolKeys: LiquidityPoolKeys;
  poolInfo: LiquidityPoolInfo;
}

export interface SerumSource {
  marketKeys: [];
  bids: [];
  asks: [];
}

export interface GetMultipleAccountsInfoConfig {
  batchRequest?: boolean;
  commitment?: Commitment;
}

export interface LiquidityFetchMultipleInfoParams {
  pools: LiquidityPoolKeys[];
  config?: GetMultipleAccountsInfoConfig;
}

export interface LiquidityComputeAmountOutParams {
  poolKeys: LiquidityPoolKeys;
  poolInfo: LiquidityPoolInfo;
  amountIn: TokenAmount;
  outputToken: Token;
  slippage: Percent;
}

export type LiquidityComputeAmountOutReturn = {
  amountOut: TokenAmount;
  minAmountOut: TokenAmount;
  currentPrice: Price;
  executionPrice: Price | null;
  priceImpact: Percent;
  fee: TokenAmount;
};

export interface LiquiditySwapTransactionParams {
  poolKeys: LiquidityPoolKeys;
  payer?: PublicKey;
  amountIn: CurrencyAmount | TokenAmount;
  amountOut: CurrencyAmount | TokenAmount;
  fixedSide: SwapSide;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}
export interface LiquiditySwapFixedOutInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: {
    tokenAccountIn: PublicKey;
    tokenAccountOut: PublicKey;
    owner: PublicKey;
  };
  // maximum amount in
  maxAmountIn: BigNumberish;
  amountOut: BigNumberish;
}

/**
 * Swap instruction params
 */
export interface LiquiditySwapInstructionParams {
  poolKeys: LiquidityPoolKeys;
  userKeys: {
    tokenAccountIn: PublicKey;
    tokenAccountOut: PublicKey;
    owner: PublicKey;
  };
  amountIn: BigNumberish;
  amountOut: BigNumberish;
  fixedSide: SwapSide;
}

export interface LiquiditySwapFixedInInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: {
    tokenAccountIn: PublicKey;
    tokenAccountOut: PublicKey;
    owner: PublicKey;
  };
  amountIn: BigNumberish;
  minAmountOut: BigNumberish;
}
