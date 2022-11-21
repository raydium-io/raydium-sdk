import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { ApiJsonPairInfo, ApiLiquidityPoolInfo, LiquidityVersion } from "../../api/type";
import { GetMultipleAccountsInfoConfig } from "../../common/accountInfo";
import { BigNumberish } from "../../common/bignumber";
import { PublicKeyish } from "../../common/pubKey";
import { JsonFileMetaData } from "../../common/json-file";
import { Percent, Price, Token, TokenAmount } from "../../module";
import { ReplaceType } from "../type";

export type LiquidityPoolJsonInfo = ApiLiquidityPoolInfo;
export type PairJsonInfo = ApiJsonPairInfo;
/* ================= pool keys ================= */
export type LiquidityPoolKeysV4 = {
  [T in keyof LiquidityPoolJsonInfo]: string extends LiquidityPoolJsonInfo[T] ? PublicKey : LiquidityPoolJsonInfo[T];
};

export type LiquiditySide = "a" | "b";
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

export type SDKParsedLiquidityInfo = ReplaceType<LiquidityPoolJsonInfo, string, PublicKey> & {
  jsonInfo: LiquidityPoolJsonInfo;
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
  amountIn: TokenAmount;
  amountOut: TokenAmount;
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

export interface LiquidityAssociatedPoolKeysV4
  extends Omit<
    LiquidityPoolKeysV4,
    | "marketBaseVault"
    | "marketQuoteVault"
    | "marketBids"
    | "marketAsks"
    | "marketEventQueue"
    | "baseDecimals"
    | "quoteDecimals"
    | "lpDecimals"
  > {
  nonce: number;
}

/**
 * Associated liquidity pool keys
 * @remarks
 * without partial markets keys
 */
export type LiquidityAssociatedPoolKeys = LiquidityAssociatedPoolKeysV4;

export interface CreatePoolParam {
  version: LiquidityVersion;
  baseMint: PublicKeyish;
  quoteMint: PublicKeyish;
  marketId: PublicKeyish;
}

export interface InitPoolParam extends CreatePoolParam {
  baseAmount: TokenAmount;
  quoteAmount: TokenAmount;
  startTime?: BigNumberish;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}

export type LiquidityInitPoolInstructionParams = {
  poolKeys: LiquidityAssociatedPoolKeysV4;
  userKeys: {
    lpTokenAccount: PublicKey;
    payer: PublicKey;
  };
  startTime: BigNumberish;
};

/**
 * Add liquidity transaction params
 */
export interface LiquidityAddTransactionParams {
  poolId: PublicKeyish;
  payer?: PublicKey;
  amountInA: TokenAmount;
  amountInB: TokenAmount;
  fixedSide: LiquiditySide;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}

/* ================= user keys ================= */
/**
 * Full user keys that build transaction need
 */
export interface LiquidityUserKeys {
  baseTokenAccount: PublicKey;
  quoteTokenAccount: PublicKey;
  lpTokenAccount: PublicKey;
  owner: PublicKey;
}

export interface LiquidityAddInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: LiquidityUserKeys;
  baseAmountIn: BigNumberish;
  quoteAmountIn: BigNumberish;
  fixedSide: AmountSide;
}

/**
 * Add liquidity instruction params
 */
export type LiquidityAddInstructionParams = LiquidityAddInstructionParamsV4;

export interface LiquidityRemoveInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: LiquidityUserKeys;
  amountIn: BigNumberish;
}
export interface LiquidityRemoveTransactionParams {
  poolId: PublicKeyish;
  payer?: PublicKey;
  amountIn: TokenAmount;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}
/**
 * Remove liquidity instruction params
 */
export type LiquidityRemoveInstructionParams = LiquidityRemoveInstructionParamsV4;

export interface LiquidityComputeAnotherAmountParams {
  poolId: PublicKeyish;
  amount: TokenAmount;
  anotherToken: Token;
  slippage: Percent;
}

export interface LiquidityPoolsJsonFile extends JsonFileMetaData {
  readonly official: LiquidityPoolJsonInfo[];
  readonly unOfficial: LiquidityPoolJsonInfo[];
}
