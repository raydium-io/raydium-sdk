import { PublicKey } from "@solana/web3.js";

import { BigNumberish } from "../../common/bignumber";

export interface RewardInfo {
  rewardMint: PublicKey;
  rewardPerSecond: BigNumberish;
  rewardOpenTime: BigNumberish;
  rewardEndTime: BigNumberish;
}

export interface FarmPoolInfoV6 {
  version: number;
  programId: PublicKey;

  lpMint: PublicKey;

  rewardInfos: RewardInfo[];

  lockInfo: {
    lockMint: PublicKey;
    lockVault: PublicKey;
  };
}
