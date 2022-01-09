import { PublicKey } from "@solana/web3.js";

import { SerumVersion } from "../serum";

import { LiquidityVersion } from "./type";

/* ================= program public keys ================= */
export const _LIQUIDITY_PROGRAM_ID_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
export const LIQUIDITY_PROGRAM_ID_V4 = new PublicKey(_LIQUIDITY_PROGRAM_ID_V4);

// liquidity program id string => liquidity version
export const LIQUIDITY_PROGRAMID_TO_VERSION: {
  [key: string]: LiquidityVersion;
} = {
  [_LIQUIDITY_PROGRAM_ID_V4]: 4,
};

// liquidity version => liquidity program id
export const LIQUIDITY_VERSION_TO_PROGRAMID: { [key in LiquidityVersion]?: PublicKey } & {
  [K: number]: PublicKey;
} = {
  4: LIQUIDITY_PROGRAM_ID_V4,
};

// liquidity version => serum version
export const LIQUIDITY_VERSION_TO_SERUM_VERSION: {
  [key in LiquidityVersion]?: SerumVersion;
} & {
  [K: number]: SerumVersion;
} = {
  4: 3,
};
