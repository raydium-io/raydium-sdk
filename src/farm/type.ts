import { JsonFileMetaData } from "../common";
import { LpTokenInfo, SplTokenInfo } from "../token";

export type FarmVersion = 3 | 4 | 5 | 6;

export interface FarmPoolBaseInfo {
  readonly id: string;
  readonly lp: LpTokenInfo | SplTokenInfo;
  readonly version: number;
}

/* ================= json file ================= */
export interface FarmPoolJsonInfoV1 {
  readonly id: string;
  readonly lpMint: string;
  readonly rewardMints: string[];

  readonly version: number;
  readonly programId: string;

  readonly authority: string;
  readonly lpVault: string;
  readonly rewardVaults: string[];
}
interface rewardInfoV3V4V5 {
  readonly rewardMint: string;
  readonly rewardVault: string;
}
interface rewardInfoV6 {
  readonly rewardMint: string;
  readonly rewardVault: string;
  readonly openTime: number;
  readonly endTime: number;
  readonly perSecond: number;
}
export interface FarmPoolJsonInfo {
  readonly id: string;
  readonly lpMint: string;
  readonly version: number;
  readonly programId: string;
  readonly authority: string;
  readonly lpVault: string;
  readonly upcoming: boolean;
  readonly rewardInfos: (rewardInfoV3V4V5 | rewardInfoV6)[];
}

export interface FarmPoolsJsonFile extends JsonFileMetaData {
  readonly official: FarmPoolJsonInfoV1[];
}
