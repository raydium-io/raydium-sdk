import { SerumVersion } from "../serum";
import { LiquidityVersion } from "./type";

export const LIQUIDITY_PROGRAM_ID_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

// liquidity program id => liquidity version
export const LIQUIDITY_PROGRAMID_TO_VERSION: {
  [key: string]: LiquidityVersion;
} = {
  [LIQUIDITY_PROGRAM_ID_V4]: 4,
};

// liquidity version => liquidity program id
export const LIQUIDITY_VERSION_TO_PROGRAMID: { [key in LiquidityVersion]?: string } & {
  [K: number]: string;
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
