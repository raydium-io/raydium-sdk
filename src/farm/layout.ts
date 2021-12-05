import BN from "bn.js";

import { PublicKey } from "@solana/web3.js";
import {
  blob, GetLayoutSchemaFromStructure, GetStructureFromLayoutSchema, GetStructureSchema, publicKey,
  seq, struct, u128, u64, u8,
} from "../marshmallow";
import { FarmVersion } from "./type";

/* ================= state layouts ================= */
export const FARM_STATE_LAYOUT_V3 = struct([
  u64("state"),
  u64("nonce"),
  publicKey("lpVault"),
  seq(publicKey(), 1, "rewardVaults"),
  publicKey(),
  publicKey(),
  u64(),
  u64(),
  seq(u64(), 1, "totalRewards"),
  seq(u128(), 1, "perShareRewards"),
  u64("lastSlot"),
  seq(u64(), 1, "perSlotRewards"),
]);

export const REAL_FARM_STATE_LAYOUT_V5 = struct([
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

export const FARM_STATE_LAYOUT_V5 = new Proxy(
  REAL_FARM_STATE_LAYOUT_V5 as GetStructureFromLayoutSchema<
    {
      rewardVaults: PublicKey[];
      totalRewards: BN[];
      perShareRewards: BN[];
      perSlotRewards: BN[];
    } & GetLayoutSchemaFromStructure<typeof REAL_FARM_STATE_LAYOUT_V5>
  >,
  {
    get(target, p, receiver) {
      if (p === "decode")
        return (...decodeParams: Parameters<typeof target["decode"]>) => {
          const originalResult = target.decode(...decodeParams);
          return {
            ...originalResult,
            rewardVaults: [originalResult.rewardVaultA, originalResult.rewardVaultB],
            totalRewards: [originalResult.totalRewardA, originalResult.totalRewardB],
            perShareRewards: [originalResult.perShareRewardA, originalResult.perShareRewardB],
            perSlotRewards: [originalResult.perSlotRewardA, originalResult.perSlotRewardB],
          };
        };
      else return Reflect.get(target, p, receiver);
    },
  },
);

export type FarmStateLayoutV3 = typeof FARM_STATE_LAYOUT_V3;
export type FarmStateLayoutV5 = typeof FARM_STATE_LAYOUT_V5;
export type FarmStateLayout = FarmStateLayoutV3 | FarmStateLayoutV5;

export type FarmStateV3 = GetStructureSchema<FarmStateLayoutV3>;
export type FarmStateV5 = GetStructureSchema<FarmStateLayoutV5>;
export type FarmState = FarmStateV3 | FarmStateV5;

/* ================= ledger layouts ================= */
export const FARM_LEDGER_LAYOUT_V3 = struct([
  u64("state"),
  publicKey("id"),
  publicKey("owner"),
  u64("deposited"),
  seq(u64(), 1, "rewardDebts"),
]);

export const FARM_LEDGER_LAYOUT_V5 = struct([
  u64("state"),
  publicKey("id"),
  publicKey("owner"),
  u64("deposited"),
  seq(u64(), 2, "rewardDebts"),
]);

export const FARM_LEDGER_LAYOUT_V5_1 = struct([
  u64("state"),
  publicKey("id"),
  publicKey("owner"),
  u64("deposited"),
  seq(u128(), 2, "rewardDebts"),
  seq(u64(), 17),
]);

export type FarmLedgerLayoutV3 = typeof FARM_LEDGER_LAYOUT_V3;
export type FarmLedgerLayoutV5 = typeof FARM_LEDGER_LAYOUT_V5;
export type FarmLedgerLayoutV5_1 = typeof FARM_LEDGER_LAYOUT_V5_1;
export type FarmLedgerLayout = FarmLedgerLayoutV3 | FarmLedgerLayoutV5;

export type FarmLedgerV3 = GetStructureSchema<FarmLedgerLayoutV3>;
export type FarmLedgerV5 = GetStructureSchema<FarmLedgerLayoutV5>;
export type FarmLedgerV5_1 = GetStructureSchema<FarmLedgerLayoutV5_1>;
export type FarmLedger = FarmLedgerV3 | FarmLedgerV5 | FarmLedgerV5_1;

/* ================= index ================= */
// version => farm state layout
export const FARM_VERSION_TO_STATE_LAYOUT: {
  [key in FarmVersion]?: FarmStateLayout;
} & {
  [K: number]: FarmStateLayout;
} = {
  3: FARM_STATE_LAYOUT_V3,
  5: FARM_STATE_LAYOUT_V5,
};

// version => farm ledger layout
export const FARM_VERSION_TO_LEDGER_LAYOUT: {
  [key in FarmVersion]?: FarmLedgerLayout;
} & {
  [K: number]: FarmLedgerLayout;
} = {
  3: FARM_LEDGER_LAYOUT_V3,
  5: FARM_LEDGER_LAYOUT_V5_1,
};
