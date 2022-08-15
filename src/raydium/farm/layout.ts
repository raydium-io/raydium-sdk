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

export const associatedLedgerAccountLayout = struct([u8("instruction")]);
export const withdrawRewardLayout = struct([u8("instruction")]);

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

export const realFarmStateV3Layout = struct([
  u64("state"),
  u64("nonce"),
  publicKey("lpVault"),
  publicKey("rewardVault"),
  publicKey(),
  publicKey(),
  u64(),
  u64(),
  u64("totalReward"),
  u128("perShareReward"),
  u64("lastSlot"),
  u64("perSlotReward"),
]);

export const realFarmStateV5Layout = struct([
  u64("state"),
  u64("nonce"),
  publicKey("lpVault"),
  publicKey("rewardVaultA"),
  u64("totalRewardA"),
  u128("perShareRewardA"),
  u64("perSlotRewardA"),
  u8("option"),
  publicKey("rewardVaultB"),
  blob(7),
  u64("totalRewardB"),
  u128("perShareRewardB"),
  u64("perSlotRewardB"),
  u64("lastSlot"),
  publicKey(),
]);

export const realFarmV6Layout = struct([
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

export const farmStateV3Layout = new Proxy(
  realFarmStateV3Layout as GetStructureFromLayoutSchema<
    {
      version: 3;
      rewardInfos: {
        rewardVault: PublicKey;
        totalReward: BN;
        perSlotReward: BN;
        perShareReward: BN;
      }[];
    } & GetLayoutSchemaFromStructure<typeof realFarmStateV3Layout>
  >,
  {
    get(target, p, receiver): any {
      if (p === "decode")
        return (...decodeParams: Parameters<typeof target["decode"]>) => {
          const originalResult = target.decode(...decodeParams);
          return {
            ...originalResult,
            version: 3,
            rewardInfos: [
              {
                rewardVault: originalResult.rewardVault,
                totalReward: originalResult.totalReward,
                perSlotReward: originalResult.perSlotReward,
                perShareReward: originalResult.perShareReward,
              },
            ],
          };
        };
      else return Reflect.get(target, p, receiver);
    },
  },
);

export const farmStateV5Layout = new Proxy(
  realFarmStateV5Layout as GetStructureFromLayoutSchema<
    {
      version: 5;
      rewardInfos: {
        rewardVault: PublicKey;
        totalReward: BN;
        perSlotReward: BN;
        perShareReward: BN;
      }[];
    } & GetLayoutSchemaFromStructure<typeof realFarmStateV5Layout>
  >,
  {
    get(target, p, receiver): any {
      if (p === "decode")
        return (...decodeParams: Parameters<typeof target["decode"]>) => {
          const originalResult = target.decode(...decodeParams);
          return {
            ...originalResult,
            version: 5,
            rewardInfos: [
              {
                rewardVault: originalResult.rewardVaultA,
                totalReward: originalResult.totalRewardA,
                perSlotReward: originalResult.perSlotRewardA,
                perShareReward: originalResult.perShareRewardA,
              },
              {
                rewardVault: originalResult.rewardVaultB,
                totalReward: originalResult.totalRewardB,
                perSlotReward: originalResult.perSlotRewardB,
                perShareReward: originalResult.perShareRewardB,
              },
            ],
          };
        };
      else return Reflect.get(target, p, receiver);
    },
  },
);

export const farmStateV6Layout = new Proxy(
  realFarmV6Layout as GetStructureFromLayoutSchema<
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
    } & GetLayoutSchemaFromStructure<typeof realFarmV6Layout>
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

export const farmRewardRestartLayout = struct([
  u8("instruction"),
  u64("rewardReopenTime"),
  u64("rewardEndTime"),
  u64("rewardPerSecond"),
]);

export const farmAddRewardLayout = struct([
  u8("instruction"),
  u64("isSet"),
  u64("rewardPerSecond"),
  u64("rewardOpenTime"),
  u64("rewardEndTime"),
]);

export type FarmStateLayoutV3 = typeof farmStateV3Layout;
export type FarmStateLayoutV5 = typeof farmStateV5Layout;
export type FarmStateLayoutV6 = typeof farmStateV6Layout;

export type FarmStateV3 = GetStructureSchema<FarmStateLayoutV3>;
export type FarmStateV5 = GetStructureSchema<FarmStateLayoutV5>;
export type FarmStateV6 = GetStructureSchema<FarmStateLayoutV6>;

export type FarmState = FarmStateV3 | FarmStateV5 | FarmStateV6;
// farmStateLayoutV3
export type FarmStateLayout = FarmStateLayoutV3 | FarmStateLayoutV5 | FarmStateLayoutV6;

/* ================= ledger layouts ================= */
export const farmLedgerLayoutV3_1 = struct([
  u64("state"),
  publicKey("id"),
  publicKey("owner"),
  u64("deposited"),
  seq(u64(), 1, "rewardDebts"),
]);

export const farmLedgerLayoutV3_2 = struct([
  u64("state"),
  publicKey("id"),
  publicKey("owner"),
  u64("deposited"),
  seq(u128(), 1, "rewardDebts"),
  seq(u64(), 17),
]);

export const farmLedgerLayoutV5_1 = struct([
  u64("state"),
  publicKey("id"),
  publicKey("owner"),
  u64("deposited"),
  seq(u64(), 2, "rewardDebts"),
]);

export const farmLedgerLayoutV5_2 = struct([
  u64("state"),
  publicKey("id"),
  publicKey("owner"),
  u64("deposited"),
  seq(u128(), 2, "rewardDebts"),
  seq(u64(), 17),
]);

export const farmLedgerLayoutV6_1 = struct([
  u64(),
  u64("state"),
  publicKey("id"),
  publicKey("owner"),
  u64("deposited"),
  seq(u128(), 5, "rewardDebts"),
  seq(u64(), 16),
]);

export type FarmLedgerLayoutV3_1 = typeof farmLedgerLayoutV3_1;
export type FarmLedgerLayoutV3_2 = typeof farmLedgerLayoutV3_2;
export type FarmLedgerLayoutV5_1 = typeof farmLedgerLayoutV5_1;
export type FarmLedgerLayoutV5_2 = typeof farmLedgerLayoutV5_2;
export type FarmLedgerLayoutV6_1 = typeof farmLedgerLayoutV6_1;
export type FarmLedgerLayout =
  | FarmLedgerLayoutV3_1
  | FarmLedgerLayoutV3_2
  | FarmLedgerLayoutV5_1
  | FarmLedgerLayoutV5_2
  | FarmLedgerLayoutV6_1;

export type FarmLedgerV3_1 = GetStructureSchema<FarmLedgerLayoutV3_1>;
export type FarmLedgerV3_2 = GetStructureSchema<FarmLedgerLayoutV3_2>;
export type FarmLedgerV5_1 = GetStructureSchema<FarmLedgerLayoutV5_1>;
export type FarmLedgerV5_2 = GetStructureSchema<FarmLedgerLayoutV5_2>;
export type FarmLedgerV6_1 = GetStructureSchema<FarmLedgerLayoutV6_1>;
export type FarmLedger = FarmLedgerV3_1 | FarmLedgerV3_2 | FarmLedgerV5_1 | FarmLedgerV5_2 | FarmLedgerV6_1;

export const dwLayout = struct([u8("instruction"), u64("amount")]);
