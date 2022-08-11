import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { BigNumberish } from "../../common/bignumber";

export interface APIRewardInfo {
  rewardMint: string;
  rewardVault: string;
  rewardOpenTime: number;
  rewardEndTime: number;
  rewardPerSecond: string | number;
  rewardSender?: string;
}
export interface FarmPoolJsonInfo {
  id: string;
  lpMint: string;
  lpVault: string;

  baseMint: string;
  quoteMint: string;
  name: string;

  version: number;
  programId: string;

  authority: string;
  creator?: string;
  rewardInfos: APIRewardInfo[];
  upcoming: boolean;

  rewardPeriodMin?: number; // v6 '7-90 days's     7 * 24 * 60 * 60 seconds
  rewardPeriodMax?: number; // v6 '7-90 days's     90 * 24 * 60 * 60 seconds
  rewardPeriodExtend?: number; // v6 'end before 72h's    72 * 60 * 60 seconds

  local: boolean; // only if it is in localstorage(create just by user)
  category: "stake" | "raydium" | "fusion" | "ecosystem"; // add by UI for unify the interface
}
export interface FarmRewardInfo {
  rewardMint: PublicKey;
  rewardPerSecond: BigNumberish;
  rewardOpenTime: BigNumberish;
  rewardEndTime: BigNumberish;
}

export interface FarmRewardInfoConfig {
  isSet: BN;
  rewardPerSecond: BN;
  rewardOpenTime: BN;
  rewardEndTime: BN;
}

export interface RewardInfoKey {
  rewardMint: PublicKey;
  rewardVault: PublicKey;
  userRewardToken: PublicKey;
}

export interface FarmPoolInfoV6 {
  version: number;
  programId: PublicKey;

  lpMint: PublicKey;

  rewardInfos: FarmRewardInfo[];

  lockInfo: {
    lockMint: PublicKey;
    lockVault: PublicKey;
  };
}

export interface RewardSetParam {
  poolId?: string;
  farmId?: string;
  rewardInfos: FarmRewardInfo[];
  newRewardInfo?: FarmRewardInfo[];
  payer?: PublicKey;
}

/* ================= pool keys ================= */
export type FarmPoolKeys = {
  readonly id: PublicKey;
  readonly lpMint: PublicKey;
  readonly version: number;
  readonly programId: PublicKey;
  readonly authority: PublicKey;
  readonly lpVault: PublicKey;
  readonly upcoming: boolean;
  readonly rewardInfos: (
    | {
        readonly rewardMint: PublicKey;
        readonly rewardVault: PublicKey;
      }
    | {
        readonly rewardMint: PublicKey;
        readonly rewardVault: PublicKey;
        readonly rewardOpenTime: number;
        readonly rewardEndTime: number;
        readonly rewardPerSecond: number;
      }
  )[];
};
