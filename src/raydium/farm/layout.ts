import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  blob,
  GetLayoutSchemaFromStructure,
  GetStructureFromLayoutSchema,
  GetStructureSchema,
  publicKey,
  seq,
  struct,
  u128,
  u64,
  u8,
} from "../../marshmallow";

const farmStateRewardInfoV6Layout = struct([
  u64("rewardState"),
  u64("rewardOpenTime"),
  u64("rewardEndTime"),
  u64("rewardLastUpdateTime"),
  u64("totalReward"),
  u64("totalRewardEmissioned"),
  u64("rewardClaimed"),
  u64("rewardPerSecond"),
  u128("accRewardPerShare"),
  publicKey("rewardVault"),
  publicKey("rewardMint"),
  publicKey("rewardSender"),
  seq(u64(), 16, "padding"),
]);

export const farmV6Layout = struct([
  u64(),
  u64("state"),
  u64("nonce"),
  u64("validRewardTokenNum"),
  u128("rewardMultiplier"),
  u64("rewardPeriodMax"),
  u64("rewardPeriodMin"),
  u64("rewardPeriodExtend"),
  publicKey("lpMint"),
  publicKey("lpVault"),
  seq(farmStateRewardInfoV6Layout, 5, "rewardInfos"),
  publicKey("creator"),
  publicKey(),
  seq(u64(), 32, "padding"),
]);

export const farmStateV6Layout = new Proxy(
  farmV6Layout as GetStructureFromLayoutSchema<
    {
      version: 6;
      rewardInfos: {
        rewardState: BN;
        rewardOpenTime: BN;
        rewardEndTime: BN;
        rewardLastUpdateTime: BN;
        totalReward: BN;
        totalRewardEmissioned: BN;
        rewardClaimed: BN;
        rewardPerSecond: BN;
        accRewardPerShare: BN;
        rewardVault: PublicKey;
        rewardMint: PublicKey;
        rewardSender: PublicKey;
      }[];
    } & GetLayoutSchemaFromStructure<typeof farmV6Layout>
  >,
  {
    get(target, p, receiver): any {
      if (p === "decode")
        return (...decodeParams: Parameters<typeof target["decode"]>) => {
          const originalResult = target.decode(...decodeParams);
          return {
            ...originalResult,
            version: 6,
            rewardInfos: originalResult.rewardInfos.map((item) => ({
              ...item,
            })),
          };
        };
      else return Reflect.get(target, p, receiver);
    },
  },
);

export const farmRewardTimeInfoLayout = struct([
  u64("isSet"),
  u64("rewardPerSecond"),
  u64("rewardOpenTime"),
  u64("rewardEndTime"),
]);

export const farmRewardLayout = struct([
  u8("instruction"),
  u64("nonce"),
  seq(farmRewardTimeInfoLayout, 5, "rewardTimeInfo"),
]);
