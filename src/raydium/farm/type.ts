import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { PublicKeyish } from "../../common";
import { BigNumberish } from "../../common/bignumber";
import { SplToken } from "../token/type";
import { Token, Price, Percent, TokenAmount } from "../../module";
import { SplAccount } from "../account/types";
import { UnionCover } from "../type";

import { poolTypeV6 } from "./config";
import { FarmStateV3, FarmStateV5, FarmStateV6 } from "./layout";

export type RewardType = keyof typeof poolTypeV6;
export interface APIRewardInfo {
  rewardMint: string;
  rewardVault: string;
  rewardOpenTime: number;
  rewardEndTime: number;
  rewardPerSecond: string | number;
  rewardSender?: string;
  rewardType: string;
}

export interface RewardInfoWithKey {
  rewardMint: PublicKey;
  rewardVault: PublicKey;
  rewardOpenTime: number;
  rewardEndTime: number;
  rewardType: RewardType;
  rewardPerSecond: string | number;
  rewardSender?: PublicKey;
}
export interface FarmPoolJsonInfo {
  id: string;
  lpMint: string;
  lpVault: string;

  baseMint: string;
  quoteMint: string;
  name: string;
  symbol: string;

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
  rewardType: RewardType;
}

export interface FarmRewardInfoConfig {
  isSet: BN;
  rewardPerSecond: BN;
  rewardOpenTime: BN;
  rewardEndTime: BN;
  rewardType: BN;
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

export interface CreateFarm {
  poolId: PublicKeyish;
  rewardInfos: FarmRewardInfo[];
  payer?: PublicKey;
}

export interface UpdateFarmReward {
  farmId: PublicKeyish;
  newRewardInfo: FarmRewardInfo;
  payer?: PublicKey;
}
export interface FarmDWParam {
  farmId: PublicKey;
  amount: BigNumberish;
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
        readonly rewardType: RewardType;
      }
  )[];
};

type SdkParsedFarmInfoBase = {
  jsonInfo: FarmPoolJsonInfo;
  id: PublicKey;
  lpMint: PublicKey;
  programId: PublicKey;
  authority: PublicKey;
  lpVault: SplAccount;
  rewardInfos: RewardInfoWithKey[];
  /** only when user have deposited and connected wallet */
  ledger?: {
    id: PublicKey;
    owner: PublicKey;
    state: BN;
    deposited: BN;
    rewardDebts: BN[];
  };
  /** only when user have deposited and connected wallet */
  wrapped?: {
    pendingRewards: BN[];
  };
};

export type SdkParsedFarmInfo = UnionCover<
  FarmPoolJsonInfo,
  SdkParsedFarmInfoBase &
    ({ version: 6; state: FarmStateV6 } | { version: 3; state: FarmStateV3 } | { version: 5; state: FarmStateV5 })
>;

/** computed by other info  */

export type HydratedRewardInfo = {
  userHavedReward: boolean;
  apr: Percent | undefined; // farm's rewards apr
  token: SplToken | Token | undefined;
  /** only when user have deposited and connected wallet */
  userPendingReward: TokenAmount | undefined;
  version: 3 | 5 | 6;
  rewardVault: PublicKey;
  openTime?: Date; // v6
  endTime?: Date; // v6

  isOptionToken?: boolean; // v6
  isRewarding?: boolean; // v6
  isRewardBeforeStart?: boolean; // v6
  isRewardEnded?: boolean; // v6
  isRwardingBeforeEnd72h?: boolean; // v6

  rewardPeriodMin?: number; // v6 '7-90 days's     7 * 24 * 60 * 60 seconds
  rewardPeriodMax?: number; // v6 '7-90 days's     90 * 24 * 60 * 60 seconds
  rewardPeriodExtend?: number; // v6 'end before 72h's    72 * 60 * 60 seconds

  claimableRewards?: TokenAmount; // v6
  owner?: string; // v6
  perSecond?: string | number; // v6
};

export type HydratedFarmInfo = SdkParsedFarmInfo & {
  lp: SplToken | Token | /* staking pool */ undefined;
  lpPrice: Price | undefined;

  base: SplToken | Token | undefined;
  quote: SplToken | Token | undefined;
  name: string;

  ammId: string | undefined;

  /** only for v3/v5 */
  isDualFusionPool: boolean;
  isNormalFusionPool: boolean;
  isClosedPool: boolean;
  isStakePool: boolean;
  isUpcomingPool: boolean;
  isStablePool: boolean;
  /** new pool shoud sort in highest  */
  isNewPool: boolean;

  /** 7d */
  totalApr7d: Percent | undefined;
  /** 7d; undefined means couldn't find this token by known tokenList */
  raydiumFeeApr7d: Percent | undefined; // raydium fee for each transaction

  totalApr30d: Percent | undefined;
  /** undefined means couldn't find this token by known tokenList */
  raydiumFeeApr30d: Percent | undefined; // raydium fee for each transaction

  totalApr24h: Percent | undefined;
  /** undefined means couldn't find this token by known tokenList */
  raydiumFeeApr24h: Percent | undefined; // raydium fee for each transaction

  tvl: TokenAmount | undefined;
  userHasStaked: boolean;
  rewards: HydratedRewardInfo[];
  userStakedLpAmount: TokenAmount | undefined;
  stakedLpAmount: TokenAmount | undefined;
};
