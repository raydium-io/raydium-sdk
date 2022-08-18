import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { LiquidityVersion, SerumVersion } from "../../api/type";

export enum LiquidityPoolStatus {
  Uninitialized,
  Initialized,
  Disabled,
  RemoveLiquidityOnly,
  LiquidityOnly,
  OrderBook,
  Swap,
  WaitingForStart,
}

export const LIQUIDITY_FEES_NUMERATOR = new BN(25);
export const LIQUIDITY_FEES_DENOMINATOR = new BN(10000);

/* ================= program public keys ================= */
export const _LIQUIDITY_PROGRAM_ID_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
export const LIQUIDITY_PROGRAM_ID_V4 = new PublicKey(_LIQUIDITY_PROGRAM_ID_V4);

export const _LIQUIDITY_PROGRAM_ID_V5 = "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h";
export const LIQUIDITY_PROGRAM_ID_V5 = new PublicKey(_LIQUIDITY_PROGRAM_ID_V5);

// liquidity program id string => liquidity version
export const LIQUIDITY_PROGRAMID_TO_VERSION: {
  [key: string]: LiquidityVersion;
} = {
  [_LIQUIDITY_PROGRAM_ID_V4]: 4,
  [_LIQUIDITY_PROGRAM_ID_V5]: 5,
};

// liquidity version => liquidity program id
export const LIQUIDITY_VERSION_TO_PROGRAM_ID: { [key in LiquidityVersion]?: PublicKey } & {
  [K: number]: PublicKey;
} = {
  4: LIQUIDITY_PROGRAM_ID_V4,
  5: LIQUIDITY_PROGRAM_ID_V5,
};

// liquidity version => serum version
export const LIQUIDITY_VERSION_TO_SERUM_VERSION: {
  [key in LiquidityVersion]?: SerumVersion;
} & {
  [K: number]: SerumVersion;
} = {
  4: 3,
  5: 3,
};
