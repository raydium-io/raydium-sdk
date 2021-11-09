import { SerumVersion } from "../serum";
import { LpTokenInfo } from "../token";
import { JsonFileMetaData } from "../types/json-file";

export type LiquidityVersion = 2 | 3 | 4;

export interface LiquidityPoolBaseInfo {
  readonly id: string;
  readonly lp: LpTokenInfo;
  // don't need version, lp's version is pool's version
}

/* ================= json file ================= */
export interface LiquidityPoolJsonInfo {
  // base
  readonly id: string;
  readonly baseMint: string;
  readonly quoteMint: string;
  readonly lpMint: string;
  // version
  readonly version: LiquidityVersion;
  readonly programId: string;
  // keys
  readonly authority: string;
  readonly openOrders: string;
  readonly targetOrders: string;
  readonly baseVault: string;
  readonly quoteVault: string;
  readonly withdrawQueue: string;
  readonly tempLpVault: string;
  // market version
  readonly marketVersion: SerumVersion;
  readonly marketProgramId: string;
  // market keys
  readonly marketId: string;
  readonly marketVaultSigner: string;
  readonly marketBaseVault: string;
  readonly marketQuoteVault: string;
  readonly marketBids: string;
  readonly marketAsks: string;
  readonly marketEventQueue: string;
}

export interface LiquidityPoolsJsonFile extends JsonFileMetaData {
  readonly official: LiquidityPoolJsonInfo[];
}
