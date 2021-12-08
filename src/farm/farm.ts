import BN from "bn.js";

import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, GetMultipleAccountsInfoConfig,
  getMultipleAccountsInfoWithCustomFlag, Logger, PublicKeyIsh, SYSTEM_PROGRAM_ID,
  SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY, TOKEN_PROGRAM_ID, validateAndParsePublicKey,
} from "../common";
import { BigNumberIsh, parseBigNumberIsh, TEN } from "../entity";
import { struct, u64, u8 } from "../marshmallow";
import { SPL_ACCOUNT_LAYOUT, SplAccount } from "../spl";
import { FARM_PROGRAMID_TO_VERSION, FARM_VERSION_TO_PROGRAMID } from "./id";
import {
  FARM_VERSION_TO_LEDGER_LAYOUT, FARM_VERSION_TO_STATE_LAYOUT, FarmLedger, FarmState,
} from "./layout";
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
  lpTokenAccount: PublicKey;
  rewardTokenAccounts: PublicKey[];
  owner: PublicKey;
}

/* ================= deposit instruction ================= */
export interface FarmDepositInstructionParams {
  poolKeys: FarmPoolKeys;
  userKeys: FarmUserKeys;
  amount: BigNumberIsh;
}

/* ================= withdraw instruction ================= */
export type FarmWithdrawInstructionParams = FarmDepositInstructionParams;

/* ================= create associated ledger account instruction ================= */
export interface CreateAssociatedLedgerAccountInstructionParams {
  poolKeys: FarmPoolKeys;
  userKeys: {
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

  static getVersion(programId: PublicKeyIsh) {
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

  static getLayouts(params: { version?: number; programId?: PublicKeyIsh }) {
    let version = 0;

    if (params.programId) {
      version = this.getVersion(params.programId);
    }
    if (params.version) {
      version = params.version;
    }

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
    const { programId } = poolKeys;
    const version = this.getVersion(programId);

    if (version === 3) {
      return this.makeDepositInstructionV3(params);
    } else if (version === 5) {
      return this.makeDepositInstructionV5(params);
    }

    return logger.throwArgumentError("invalid program id", "params.poolKeys.programId", programId.toBase58());
  }

  static makeDepositInstructionV3(params: FarmDepositInstructionParams) {
    const { poolKeys, userKeys, amount } = params;

    const { rewardVaults } = poolKeys;
    const { rewardTokenAccounts } = userKeys;

    if (rewardTokenAccounts.length !== 1) {
      return logger.throwArgumentError(
        "rewardTokenAccounts lengths not equal 1",
        "params.userKeys.rewardTokenAccounts",
        rewardTokenAccounts,
      );
    }
    if (rewardVaults.length !== 1) {
      return logger.throwArgumentError(
        "rewardVaults lengths not equal 1",
        "params.poolKeys.rewardVaults",
        rewardVaults,
      );
    }

    const LAYOUT = struct([u8("instruction"), u64("amount")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 1,
        amount: parseBigNumberIsh(amount),
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
      AccountMeta(rewardTokenAccounts[0], false),
      AccountMeta(rewardVaults[0], false),
      AccountMetaReadonly(SYSVAR_CLOCK_PUBKEY, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  static makeDepositInstructionV5(params: FarmDepositInstructionParams) {
    const { poolKeys, userKeys, amount } = params;

    const { rewardVaults } = poolKeys;
    const { rewardTokenAccounts } = userKeys;

    if (rewardTokenAccounts.length !== rewardVaults.length) {
      return logger.throwArgumentError(
        "rewardTokenAccounts lengths not equal with params.poolKeys.rewardVaults",
        "params.userKeys.rewardTokenAccounts",
        rewardTokenAccounts,
      );
    }

    const LAYOUT = struct([u8("instruction"), u64("amount")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 11,
        amount: parseBigNumberIsh(amount),
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
      AccountMeta(rewardTokenAccounts[0], false),
      AccountMeta(rewardVaults[0], false),
      AccountMetaReadonly(SYSVAR_CLOCK_PUBKEY, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    ];

    for (let index = 1; index < rewardVaults.length; index++) {
      keys.push(AccountMeta(rewardTokenAccounts[index], false));
      keys.push(AccountMeta(rewardVaults[index], false));
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
    const { programId } = poolKeys;
    const version = this.getVersion(programId);

    if (version === 3) {
      return this.makeWithdrawInstructionV3(params);
    } else if (version === 5) {
      return this.makeWithdrawInstructionV5(params);
    }

    return logger.throwArgumentError("Unsupported program id", "params.poolKeys.programId", programId.toBase58());
  }

  static makeWithdrawInstructionV3(params: FarmWithdrawInstructionParams) {
    const { poolKeys, userKeys, amount } = params;

    const { rewardVaults } = poolKeys;
    const { rewardTokenAccounts } = userKeys;

    if (rewardTokenAccounts.length !== 1) {
      return logger.throwArgumentError(
        "rewardTokenAccounts lengths not equal 1",
        "params.userKeys.rewardTokenAccounts",
        rewardTokenAccounts,
      );
    }
    if (rewardVaults.length !== 1) {
      return logger.throwArgumentError(
        "rewardVaults lengths not equal 1",
        "params.poolKeys.rewardVaults",
        rewardVaults,
      );
    }

    const LAYOUT = struct([u8("instruction"), u64("amount")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 2,
        amount: parseBigNumberIsh(amount),
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
      AccountMeta(rewardTokenAccounts[0], false),
      AccountMeta(rewardVaults[0], false),
      AccountMetaReadonly(SYSVAR_CLOCK_PUBKEY, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  static makeWithdrawInstructionV5(params: FarmWithdrawInstructionParams) {
    const { poolKeys, userKeys, amount } = params;

    const { rewardVaults } = poolKeys;
    const { rewardTokenAccounts } = userKeys;

    if (rewardTokenAccounts.length !== rewardVaults.length) {
      return logger.throwArgumentError(
        "rewardTokenAccounts lengths not equal with params.poolKeys.rewardVaults",
        "params.userKeys.rewardTokenAccounts",
        rewardTokenAccounts,
      );
    }

    const LAYOUT = struct([u8("instruction"), u64("amount")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 12,
        amount: parseBigNumberIsh(amount),
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
      AccountMeta(rewardTokenAccounts[0], false),
      AccountMeta(rewardVaults[0], false),
      AccountMetaReadonly(SYSVAR_CLOCK_PUBKEY, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    ];

    for (let index = 1; index < rewardVaults.length; index++) {
      keys.push(AccountMeta(rewardTokenAccounts[index], false));
      keys.push(AccountMeta(rewardVaults[index], false));
    }

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  /* ================= create associated ledger account ================= */
  static async makeCreateAssociatedLedgerAccountInstruction(params: CreateAssociatedLedgerAccountInstructionParams) {
    const { poolKeys, userKeys } = params;
    const { programId } = poolKeys;
    const version = this.getVersion(programId);

    if (version !== 3 && version !== 5) {
      return logger.throwArgumentError("invalid program id", "params.poolKeys.programId", programId.toBase58());
    }

    const LAYOUT = struct([u8("instruction")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 10,
      },
      data,
    );

    const ledger = await this.getAssociatedLedger({
      programId: poolKeys.programId,
      poolId: poolKeys.id,
      owner: userKeys.owner,
    });

    const keys = [
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(ledger, false),
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
      [key: string]: {
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
        const multiplier = TEN.pow(new BN(15));

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

    return Object.values(poolsInfo);
  }
}
