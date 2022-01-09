import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, GetMultipleAccountsInfoConfig,
  getMultipleAccountsInfoWithCustomFlag, Logger, PublicKeyish, SYSTEM_PROGRAM_ID, SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY, TOKEN_PROGRAM_ID, validateAndParsePublicKey,
} from "../common";
import { BigNumberish, parseBigNumberish, TEN } from "../entity";
import { struct, u64, u8 } from "../marshmallow";
import { SPL_ACCOUNT_LAYOUT, SplAccount } from "../spl";

import { FARM_PROGRAMID_TO_VERSION, FARM_VERSION_TO_PROGRAMID } from "./id";
import { FARM_VERSION_TO_LEDGER_LAYOUT, FARM_VERSION_TO_STATE_LAYOUT, FarmLedger, FarmState } from "./layout";
import { FarmPoolJsonInfo } from "./type";

const logger = new Logger("Farm");

/* ================= pool keys ================= */
export type FarmPoolKeys = {
  [T in keyof FarmPoolJsonInfo]: FarmPoolJsonInfo[T] extends string
    ? PublicKey
    : FarmPoolJsonInfo[T] extends string[]
    ? PublicKey[]
    : FarmPoolJsonInfo[T];
};

export interface FarmUserKeys {
  ledger: PublicKey;
  auxiliaryLedgers?: PublicKey[];
  lpTokenAccount: PublicKey;
  rewardTokenAccounts: PublicKey[];
  owner: PublicKey;
}

/* ================= deposit instruction ================= */
export interface FarmDepositInstructionParams {
  poolKeys: FarmPoolKeys;
  userKeys: FarmUserKeys;
  amount: BigNumberish;
}

/* ================= withdraw instruction ================= */
export type FarmWithdrawInstructionParams = FarmDepositInstructionParams;

/* ================= create associated ledger account instruction ================= */
export interface CreateAssociatedLedgerAccountInstructionParams {
  poolKeys: FarmPoolKeys;
  userKeys: {
    ledger: PublicKey;
    owner: PublicKey;
  };
}

export interface GetFarmMultipleInfoParams {
  connection: Connection;
  pools: FarmPoolKeys[];
  owner?: PublicKey;
  config?: GetMultipleAccountsInfoConfig;
}

export class Farm {
  /* ================= static functions ================= */
  static getProgramId(version: number) {
    const programId = FARM_VERSION_TO_PROGRAMID[version];
    if (!programId) {
      return logger.throwArgumentError("invalid version", "version", version);
    }

    return programId;
  }

  static getVersion(programId: PublicKeyish) {
    const programIdPubKey = validateAndParsePublicKey(programId);
    const programIdString = programIdPubKey.toBase58();

    const version = FARM_PROGRAMID_TO_VERSION[programIdString];
    if (!version) {
      return logger.throwArgumentError("invalid program id", "programId", programIdString);
    }

    return version;
  }

  static getStateLayout(version: number) {
    const STATE_LAYOUT = FARM_VERSION_TO_STATE_LAYOUT[version];
    if (!STATE_LAYOUT) {
      return logger.throwArgumentError("invalid version", "version", version);
    }

    return STATE_LAYOUT;
  }

  static getLedgerLayout(version: number) {
    const LEDGER_LAYOUT = FARM_VERSION_TO_LEDGER_LAYOUT[version];
    if (!LEDGER_LAYOUT) {
      return logger.throwArgumentError("invalid version", "version", version);
    }

    return LEDGER_LAYOUT;
  }

  static getLayouts(version: number) {
    return { state: this.getStateLayout(version), ledger: this.getLedgerLayout(version) };
  }

  static getAssociatedAuthority({ programId, poolId }: { programId: PublicKey; poolId: PublicKey }) {
    return findProgramAddress([poolId.toBuffer()], programId);
  }

  static async getAssociatedLedger({
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

  /* ================= instructions ================= */
  /* ================= deposit ================= */
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
    if (userKeys.rewardTokenAccounts.length !== 1) {
      return logger.throwArgumentError(
        "lengths not equal 1",
        "userKeys.rewardTokenAccounts",
        userKeys.rewardTokenAccounts,
      );
    }
    if (poolKeys.rewardVaults.length !== 1) {
      return logger.throwArgumentError("lengths not equal 1", "poolKeys.rewardVaults", poolKeys.rewardVaults);
    }

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
    if (userKeys.rewardTokenAccounts.length !== poolKeys.rewardVaults.length) {
      return logger.throwArgumentError(
        "lengths not equal with poolKeys.rewardVaults",
        "userKeys.rewardTokenAccounts",
        userKeys.rewardTokenAccounts,
      );
    }

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

  /* ================= withdraw ================= */
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
    if (userKeys.rewardTokenAccounts.length !== 1) {
      return logger.throwArgumentError(
        "lengths not equal 1",
        "userKeys.rewardTokenAccounts",
        userKeys.rewardTokenAccounts,
      );
    }
    if (poolKeys.rewardVaults.length !== 1) {
      return logger.throwArgumentError("lengths not equal 1", "poolKeys.rewardVaults", poolKeys.rewardVaults);
    }

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
    if (userKeys.rewardTokenAccounts.length !== poolKeys.rewardVaults.length) {
      return logger.throwArgumentError(
        "lengths not equal with params.poolKeys.rewardVaults",
        "userKeys.rewardTokenAccounts",
        userKeys.rewardTokenAccounts,
      );
    }

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

  /* ================= create associated ledger account ================= */
  static makeCreateAssociatedLedgerAccountInstruction(params: CreateAssociatedLedgerAccountInstructionParams) {
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
  }: CreateAssociatedLedgerAccountInstructionParams) {
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
  }: CreateAssociatedLedgerAccountInstructionParams) {
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
      AccountMetaReadonly(SYSTEM_PROGRAM_ID, false),
      AccountMetaReadonly(SYSVAR_RENT_PUBKEY, false),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  static async getMultipleInfo({ connection, pools, owner, config }: GetFarmMultipleInfoParams) {
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
          pubkey: await this.getAssociatedLedger({ programId: pool.programId, poolId: pool.id, owner }),
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

    const accountsInfo = await getMultipleAccountsInfoWithCustomFlag(connection, publicKeys, config);
    for (const { pubkey, version, key, poolId, accountInfo } of accountsInfo) {
      if (key === "state") {
        const STATE_LAYOUT = this.getStateLayout(version);
        if (!accountInfo || !accountInfo.data || accountInfo.data.length !== STATE_LAYOUT.span) {
          return logger.throwArgumentError("invalid farm state account info", "pools.id", pubkey.toBase58());
        }

        poolsInfo[poolId.toBase58()] = {
          ...poolsInfo[poolId.toBase58()],
          ...{ state: STATE_LAYOUT.decode(accountInfo.data) },
        };
      } else if (key === "lpVault") {
        if (!accountInfo || !accountInfo.data || accountInfo.data.length !== SPL_ACCOUNT_LAYOUT.span) {
          return logger.throwArgumentError("invalid farm lp vault account info", "pools.lpVault", pubkey.toBase58());
        }

        poolsInfo[poolId.toBase58()] = {
          ...poolsInfo[poolId.toBase58()],
          ...{ lpVault: SPL_ACCOUNT_LAYOUT.decode(accountInfo.data) },
        };
      } else if (key === "ledger") {
        const LEDGER_LAYOUT = this.getLedgerLayout(version);
        if (accountInfo && accountInfo.data) {
          if (accountInfo.data.length !== LEDGER_LAYOUT.span) {
            return logger.throwArgumentError("invalid farm ledger account info", "ledger", pubkey.toBase58());
          }

          poolsInfo[poolId.toBase58()] = {
            ...poolsInfo[poolId.toBase58()],
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
