import { JsonFileMetaData } from "../common";
import { LpTokenInfo, SplTokenInfo } from "../token";

export type FarmVersion = 3 | 4 | 5;

export interface FarmPoolBaseInfo {
  readonly id: string;
  readonly lp: LpTokenInfo | SplTokenInfo;
  readonly version: number;
}

/* ================= json file ================= */
export interface FarmPoolJsonInfo {
  readonly id: string;
  readonly lpMint: string;
  readonly rewardMints: string[];

  readonly version: number;
  readonly programId: string;

  readonly authority: string;
  readonly lpVault: string;
  readonly rewardVaults: string[];
}

export interface FarmPoolsJsonFile extends JsonFileMetaData {
  readonly official: FarmPoolJsonInfo[];
}
