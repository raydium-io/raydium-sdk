import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, GetMultipleAccountsInfoConfig,
  getMultipleAccountsInfoWithCustomFlags, Logger, PublicKeyish, SYSTEM_PROGRAM_ID, SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY, TOKEN_PROGRAM_ID, validateAndParsePublicKey,
} from "../common";
import { BigNumberish, parseBigNumberish, TEN } from "../entity";
import { struct, u64, u8 } from "../marshmallow";
import { SPL_ACCOUNT_LAYOUT, SplAccount } from "../spl";

import { FARM_PROGRAMID_TO_VERSION, FARM_VERSION_TO_PROGRAMID } from "./id";
import { FARM_VERSION_TO_LEDGER_LAYOUT, FARM_VERSION_TO_STATE_LAYOUT, FarmLedger, FarmState } from "./layout";
import { FarmPoolJsonInfo } from "./type";

const logger = Logger.from("Farm");

/* ================= pool keys ================= */
export type FarmPoolKeys = {
  [T in keyof FarmPoolJsonInfo]: FarmPoolJsonInfo[T] extends string
    ? PublicKey
    : FarmPoolJsonInfo[T] extends string[]
    ? PublicKey[]
    : FarmPoolJsonInfo[T];
};

/* ================= user keys ================= */
/**
 * Full user keys that build transaction need
 */
export interface FarmUserKeys {
  ledger: PublicKey;
  auxiliaryLedgers?: PublicKey[];
  lpTokenAccount: PublicKey;
  rewardTokenAccounts: PublicKey[];
  owner: PublicKey;
}

/* ================= make instruction and transaction ================= */
export interface FarmDepositInstructionParams {
  poolKeys: FarmPoolKeys;
  userKeys: FarmUserKeys;
  amount: BigNumberish;
}

export type FarmWithdrawInstructionParams = FarmDepositInstructionParams;

export interface FarmCreateAssociatedLedgerAccountInstructionParams {
  poolKeys: FarmPoolKeys;
  userKeys: {
    ledger: PublicKey;
    owner: PublicKey;
  };
}

/* ================= fetch data ================= */
export interface FarmFetchMultipleInfoParams {
  connection: Connection;
  pools: FarmPoolKeys[];
  owner?: PublicKey;
  config?: GetMultipleAccountsInfoConfig;
}

export class Farm {
  /* ================= get version and program id ================= */
  static getProgramId(version: number) {
    const programId = FARM_VERSION_TO_PROGRAMID[version];
    logger.assertArgument(!!programId, "invalid version", "version", version);

    return programId;
  }

  static getVersion(programId: PublicKeyish) {
    const programIdPubKey = validateAndParsePublicKey(programId);
    const programIdString = programIdPubKey.toBase58();

    const version = FARM_PROGRAMID_TO_VERSION[programIdString];
    logger.assertArgument(!!version, "invalid program id", "programId", programIdString);

    return version;
  }

  /* ================= get layout ================= */
  static getStateLayout(version: number) {
    const STATE_LAYOUT = FARM_VERSION_TO_STATE_LAYOUT[version];
    logger.assertArgument(!!STATE_LAYOUT, "invalid version", "version", version);

    return STATE_LAYOUT;
  }

  static getLedgerLayout(version: number) {
    const LEDGER_LAYOUT = FARM_VERSION_TO_LEDGER_LAYOUT[version];
    logger.assertArgument(!!LEDGER_LAYOUT, "invalid version", "version", version);

    return LEDGER_LAYOUT;
  }

  static getLayouts(version: number) {
    return { state: this.getStateLayout(version), ledger: this.getLedgerLayout(version) };
  }

  /* ================= get key ================= */
  static getAssociatedAuthority({ programId, poolId }: { programId: PublicKey; poolId: PublicKey }) {
    return findProgramAddress([poolId.toBuffer()], programId);
  }

  static async getAssociatedLedgerAccount({
    programId,
    poolId,
    owner,
  }: {
    programId: PublicKey;
    poolId: PublicKey;
    owner: PublicKey;
  }) {
    const { publicKey } = await findProgramAddress(
      [poolId.toBuffer(), owner.toBuffer(), Buffer.from("staker_info_v2_associated_seed", "utf-8")],
      programId,
    );
    return publicKey;
  }

  /* ================= make instruction and transaction ================= */
  static makeDepositInstruction(params: FarmDepositInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 3) {
      return this.makeDepositInstructionV3(params);
    } else if (version === 5) {
      return this.makeDepositInstructionV5(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static makeDepositInstructionV3({ poolKeys, userKeys, amount }: FarmDepositInstructionParams) {
    logger.assertArgument(
      poolKeys.rewardVaults.length === 1,
      "lengths not equal 1",
      "poolKeys.rewardVaults",
      poolKeys.rewardVaults,
    );
    logger.assertArgument(
      userKeys.rewardTokenAccounts.length === 1,
      "lengths not equal 1",
      "userKeys.rewardTokenAccounts",
      userKeys.rewardTokenAccounts,
    );

    const LAYOUT = struct([u8("instruction"), u64("amount")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 10,
        amount: parseBigNumberish(amount),
      },
      data,
    );

    const keys = [
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMeta(userKeys.ledger, false),
      AccountMetaReadonly(userKeys.owner, true),
      AccountMeta(userKeys.lpTokenAccount, false),
      AccountMeta(poolKeys.lpVault, false),
      AccountMeta(userKeys.rewardTokenAccounts[0], false),
      AccountMeta(poolKeys.rewardVaults[0], false),
      // system
      AccountMetaReadonly(SYSVAR_CLOCK_PUBKEY, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    ];

    if (userKeys.auxiliaryLedgers) {
      for (const auxiliaryLedger of userKeys.auxiliaryLedgers) {
        keys.push(AccountMeta(auxiliaryLedger, false));
      }
    }

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  static makeDepositInstructionV5({ poolKeys, userKeys, amount }: FarmDepositInstructionParams) {
    logger.assertArgument(
      userKeys.rewardTokenAccounts.length === poolKeys.rewardVaults.length,
      "lengths not equal with poolKeys.rewardVaults",
      "userKeys.rewardTokenAccounts",
      userKeys.rewardTokenAccounts,
    );

    const LAYOUT = struct([u8("instruction"), u64("amount")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 11,
        amount: parseBigNumberish(amount),
      },
      data,
    );

    const keys = [
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMeta(userKeys.ledger, false),
      AccountMetaReadonly(userKeys.owner, true),
      AccountMeta(userKeys.lpTokenAccount, false),
      AccountMeta(poolKeys.lpVault, false),
      AccountMeta(userKeys.rewardTokenAccounts[0], false),
      AccountMeta(poolKeys.rewardVaults[0], false),
      // system
      AccountMetaReadonly(SYSVAR_CLOCK_PUBKEY, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    ];

    for (let index = 1; index < poolKeys.rewardVaults.length; index++) {
      keys.push(AccountMeta(userKeys.rewardTokenAccounts[index], false));
      keys.push(AccountMeta(poolKeys.rewardVaults[index], false));
    }

    if (userKeys.auxiliaryLedgers) {
      for (const auxiliaryLedger of userKeys.auxiliaryLedgers) {
        keys.push(AccountMeta(auxiliaryLedger, false));
      }
    }

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  static makeWithdrawInstruction(params: FarmWithdrawInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 3) {
      return this.makeWithdrawInstructionV3(params);
    } else if (version === 5) {
      return this.makeWithdrawInstructionV5(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static makeWithdrawInstructionV3({ poolKeys, userKeys, amount }: FarmWithdrawInstructionParams) {
    logger.assertArgument(
      poolKeys.rewardVaults.length === 1,
      "lengths not equal 1",
      "poolKeys.rewardVaults",
      poolKeys.rewardVaults,
    );
    logger.assertArgument(
      userKeys.rewardTokenAccounts.length === 1,
      "lengths not equal 1",
      "userKeys.rewardTokenAccounts",
      userKeys.rewardTokenAccounts,
    );

    const LAYOUT = struct([u8("instruction"), u64("amount")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 11,
        amount: parseBigNumberish(amount),
      },
      data,
    );

    const keys = [
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMeta(userKeys.ledger, false),
      AccountMetaReadonly(userKeys.owner, true),
      AccountMeta(userKeys.lpTokenAccount, false),
      AccountMeta(poolKeys.lpVault, false),
      AccountMeta(userKeys.rewardTokenAccounts[0], false),
      AccountMeta(poolKeys.rewardVaults[0], false),
      // system
      AccountMetaReadonly(SYSVAR_CLOCK_PUBKEY, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    ];

    if (userKeys.auxiliaryLedgers) {
      for (const auxiliaryLedger of userKeys.auxiliaryLedgers) {
        keys.push(AccountMeta(auxiliaryLedger, false));
      }
    }

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  static makeWithdrawInstructionV5({ poolKeys, userKeys, amount }: FarmWithdrawInstructionParams) {
    logger.assertArgument(
      userKeys.rewardTokenAccounts.length === poolKeys.rewardVaults.length,
      "lengths not equal with params.poolKeys.rewardVaults",
      "userKeys.rewardTokenAccounts",
      userKeys.rewardTokenAccounts,
    );

    const LAYOUT = struct([u8("instruction"), u64("amount")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 12,
        amount: parseBigNumberish(amount),
      },
      data,
    );

    const keys = [
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMeta(userKeys.ledger, false),
      AccountMetaReadonly(userKeys.owner, true),
      AccountMeta(userKeys.lpTokenAccount, false),
      AccountMeta(poolKeys.lpVault, false),
      AccountMeta(userKeys.rewardTokenAccounts[0], false),
      AccountMeta(poolKeys.rewardVaults[0], false),
      // system
      AccountMetaReadonly(SYSVAR_CLOCK_PUBKEY, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    ];

    for (let index = 1; index < poolKeys.rewardVaults.length; index++) {
      keys.push(AccountMeta(userKeys.rewardTokenAccounts[index], false));
      keys.push(AccountMeta(poolKeys.rewardVaults[index], false));
    }

    if (userKeys.auxiliaryLedgers) {
      for (const auxiliaryLedger of userKeys.auxiliaryLedgers) {
        keys.push(AccountMeta(auxiliaryLedger, false));
      }
    }

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  static makeCreateAssociatedLedgerAccountInstruction(params: FarmCreateAssociatedLedgerAccountInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 3) {
      return this.makeCreateAssociatedLedgerAccountInstructionV3(params);
    } else if (version === 5) {
      return this.makeCreateAssociatedLedgerAccountInstructionV5(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static makeCreateAssociatedLedgerAccountInstructionV3({
    poolKeys,
    userKeys,
  }: FarmCreateAssociatedLedgerAccountInstructionParams) {
    const LAYOUT = struct([u8("instruction")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 9,
      },
      data,
    );

    const keys = [
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(userKeys.ledger, false),
      AccountMetaReadonly(userKeys.owner, true),
      // system
      AccountMetaReadonly(SYSTEM_PROGRAM_ID, false),
      AccountMetaReadonly(SYSVAR_RENT_PUBKEY, false),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  static makeCreateAssociatedLedgerAccountInstructionV5({
    poolKeys,
    userKeys,
  }: FarmCreateAssociatedLedgerAccountInstructionParams) {
    const LAYOUT = struct([u8("instruction")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 10,
      },
      data,
    );

    const keys = [
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(userKeys.ledger, false),
      AccountMetaReadonly(userKeys.owner, true),
      // system
      AccountMetaReadonly(SYSTEM_PROGRAM_ID, false),
      AccountMetaReadonly(SYSVAR_RENT_PUBKEY, false),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  /* ================= fetch data ================= */
  static async fetchMultipleInfo({ connection, pools, owner, config }: FarmFetchMultipleInfoParams) {
    const publicKeys: {
      pubkey: PublicKey;
      version: number;
      key: "state" | "lpVault" | "ledger";
      poolId: PublicKey;
    }[] = [];

    for (const pool of pools) {
      publicKeys.push({
        pubkey: pool.id,
        version: pool.version,
        key: "state",
        poolId: pool.id,
      });

      publicKeys.push({
        pubkey: pool.lpVault,
        version: pool.version,
        key: "lpVault",
        poolId: pool.id,
      });

      if (owner) {
        publicKeys.push({
          pubkey: await this.getAssociatedLedgerAccount({ programId: pool.programId, poolId: pool.id, owner }),
          version: pool.version,
          key: "ledger",
          poolId: pool.id,
        });
      }
    }

    const poolsInfo: {
      [id: string]: {
        state: FarmState;
        lpVault: SplAccount;
        ledger?: FarmLedger;
        // wrapped data
        wrapped?: { pendingRewards: BN[] };
      };
    } = {};

    const accountsInfo = await getMultipleAccountsInfoWithCustomFlags(connection, publicKeys, config);
    for (const { pubkey, version, key, poolId, accountInfo } of accountsInfo) {
      const _poolId = poolId.toBase58();

      if (key === "state") {
        const STATE_LAYOUT = this.getStateLayout(version);
        if (!accountInfo || !accountInfo.data || accountInfo.data.length !== STATE_LAYOUT.span) {
          return logger.throwArgumentError("invalid farm state account info", "pools.id", pubkey);
        }

        poolsInfo[_poolId] = {
          ...poolsInfo[_poolId],
          ...{ state: STATE_LAYOUT.decode(accountInfo.data) },
        };
      } else if (key === "lpVault") {
        if (!accountInfo || !accountInfo.data || accountInfo.data.length !== SPL_ACCOUNT_LAYOUT.span) {
          return logger.throwArgumentError("invalid farm lp vault account info", "pools.lpVault", pubkey);
        }

        poolsInfo[_poolId] = {
          ...poolsInfo[_poolId],
          ...{ lpVault: SPL_ACCOUNT_LAYOUT.decode(accountInfo.data) },
        };
      } else if (key === "ledger") {
        const LEDGER_LAYOUT = this.getLedgerLayout(version);
        if (accountInfo && accountInfo.data) {
          logger.assertArgument(
            accountInfo.data.length === LEDGER_LAYOUT.span,
            "invalid farm ledger account info",
            "ledger",
            pubkey,
          );

          poolsInfo[_poolId] = {
            ...poolsInfo[_poolId],
            ...{ ledger: LEDGER_LAYOUT.decode(accountInfo.data) },
          };
        }
      }
    }

    // wrapped data
    for (const [poolId, { state, ledger }] of Object.entries(poolsInfo)) {
      if (ledger) {
        let multiplier = TEN.pow(new BN(15));
        // for stake pool
        if (state.perShareRewards.length === 1) {
          multiplier = TEN.pow(new BN(9));
        }

        const pendingRewards = state.perShareRewards.map((perShareReward, index) => {
          const rewardDebt = ledger.rewardDebts[index];
          const pendingReward = ledger.deposited.mul(perShareReward).div(multiplier).sub(rewardDebt);

          return pendingReward;
        });

        poolsInfo[poolId].wrapped = {
          ...poolsInfo[poolId].wrapped,
          pendingRewards,
        };
      }
    }

    return poolsInfo;
  }
}
