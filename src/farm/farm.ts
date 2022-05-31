import { Keypair } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import {
  AccountMeta,
  AccountMetaReadonly,
  findProgramAddress,
  GetMultipleAccountsInfoConfig,
  getMultipleAccountsInfoWithCustomFlags,
  Logger,
  PublicKeyish,
  SYSTEM_PROGRAM_ID,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TOKEN_PROGRAM_ID,
  validateAndParsePublicKey,
} from "../common";
import { BigNumberish, parseBigNumberish, TEN } from "../entity";
import { struct, u64, u8, seq } from "../marshmallow";
import { SPL_ACCOUNT_LAYOUT, SplAccount } from "../spl";

import { FARM_PROGRAMID_TO_VERSION, FARM_VERSION_TO_PROGRAMID } from "./id";
import {
  FARM_VERSION_TO_LEDGER_LAYOUT,
  FARM_VERSION_TO_STATE_LAYOUT,
  FarmLedger,
  FarmState,
  FARM_STATE_LAYOUT_V6,
  FarmStateV3,
  FarmStateV5,
  FarmLedgerOld,
  FarmStateV6,
  FarmLedgerV6_1,
} from "./layout";

const logger = Logger.from("Farm");

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
        readonly openTime: number;
        readonly endTime: number;
        readonly perSecond: number;
      }
  )[];
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

export interface FarmLockInfo {
  lockMint: PublicKey;
  userLockAccount: PublicKey;
}

export interface FarmRewardInfo {
  rewardMint: PublicKey;
  rewardPerSecond: BigNumberish;
  rewardStartTime: BigNumberish;
  rewardEndTime: BigNumberish;
  rewardOwnerAccount: PublicKey; // user account
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

export interface FarmCreateInstructionParamsV6 {
  version: 6;
  programId: PublicKey;

  lpMint: PublicKey;

  rewardInfos: {
    rewardMint: PublicKey;
    rewardOwnerAccount: PublicKey; // user account
    rewardPerSecond: BigNumberish;
    rewardStartTime: BigNumberish;
    rewardEndTime: BigNumberish;
  }[];
}

export type FarmCreateInstructionParams = FarmCreateInstructionParamsV6;

export interface FarmRestartInstructionParamsV6 {
  poolKeys: FarmPoolKeys;

  rewardOwner: PublicKey;
  rewardVault: PublicKey;
  rewardOwnerAccount: PublicKey;

  rewardRestartTime: number;
  rewardEndTime: number;
  rewardPerSecond: BigNumberish;
}

export type FarmRestartInstructionParams = FarmRestartInstructionParamsV6;
export interface FarmWithdrawRewardInstructionParamsV6 {
  poolKeys: FarmPoolKeys;

  owner: PublicKey;
  rewardVault: PublicKey;
  userVault: PublicKey;
}

export type FarmWithdrawRewardInstructionParams = FarmWithdrawRewardInstructionParamsV6;

export interface FarmCreatorAddRewardTokenInstructionParamsV6 {
  poolKeys: FarmPoolKeys;

  owner: PublicKey;
  newRewardInfo: FarmRewardInfo;
}

export type FarmCreatorAddRewardTokenInstructionParams = FarmCreatorAddRewardTokenInstructionParamsV6;

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
      [
        poolId.toBuffer(),
        owner.toBuffer(),
        Buffer.from(
          Farm.getVersion(programId) === 6 ? "farmer_info_associated_seed" : "staker_info_v2_associated_seed",
          "utf-8",
        ),
      ],
      programId,
    );
    return publicKey;
  }

  static async getAssociatedLedgerPoolAccount({
    programId,
    poolId,
    mint,
    type,
  }: {
    programId: PublicKey;
    poolId: PublicKey;
    mint: PublicKey;
    type: "lpVault" | "rewardVault" | "lockVault";
  }) {
    const { publicKey } = await findProgramAddress(
      [
        poolId.toBuffer(),
        mint.toBuffer(),
        Buffer.from(
          type === "lpVault"
            ? "lp_vault_associated_seed"
            : type === "rewardVault"
            ? "reward_vault_associated_seed"
            : type === "lockVault"
            ? "lock_vault_associated_seed"
            : "",
          "utf-8",
        ),
      ],
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
    } else if (version === 6) {
      return this.makeDepositInstructionV6(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static makeDepositInstructionV3({ poolKeys, userKeys, amount }: FarmDepositInstructionParams) {
    logger.assertArgument(
      poolKeys.rewardInfos.length === 1,
      "lengths not equal 1",
      "poolKeys.rewardInfos",
      poolKeys.rewardInfos,
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
      AccountMeta(poolKeys.rewardInfos[0].rewardVault, false),
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
      userKeys.rewardTokenAccounts.length === poolKeys.rewardInfos.length,
      "lengths not equal with poolKeys.rewardInfos",
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
      AccountMeta(poolKeys.rewardInfos[0].rewardVault, false),
      // system
      AccountMetaReadonly(SYSVAR_CLOCK_PUBKEY, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    ];

    for (let index = 1; index < poolKeys.rewardInfos.length; index++) {
      keys.push(AccountMeta(userKeys.rewardTokenAccounts[index], false));
      keys.push(AccountMeta(poolKeys.rewardInfos[index].rewardVault, false));
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

  static makeDepositInstructionV6({ poolKeys, userKeys, amount }: FarmDepositInstructionParams) {
    logger.assertArgument(
      userKeys.rewardTokenAccounts.length !== 0,
      "lengths equal zero",
      "userKeys.rewardTokenAccounts",
      userKeys.rewardTokenAccounts,
    );
    logger.assertArgument(
      userKeys.rewardTokenAccounts.length === poolKeys.rewardInfos.length,
      "lengths not equal with poolKeys.rewardInfos",
      "userKeys.rewardTokenAccounts",
      userKeys.rewardTokenAccounts,
    );

    const LAYOUT = struct([u8("instruction"), u64("amount")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 1,
        amount: parseBigNumberish(amount),
      },
      data,
    );

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
      AccountMetaReadonly(SYSTEM_PROGRAM_ID, false),
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMeta(poolKeys.lpVault, false),
      AccountMeta(userKeys.ledger, false),
      AccountMetaReadonly(userKeys.owner, true),
      AccountMeta(userKeys.lpTokenAccount, false),
    ];

    for (let index = 0; index < poolKeys.rewardInfos.length; index++) {
      keys.push(AccountMeta(poolKeys.rewardInfos[index].rewardVault, false));
      keys.push(AccountMeta(userKeys.rewardTokenAccounts[index], false));
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
    } else if (version === 6) {
      return this.makeWithdrawInstructionV6(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static makeWithdrawInstructionV3({ poolKeys, userKeys, amount }: FarmWithdrawInstructionParams) {
    logger.assertArgument(
      poolKeys.rewardInfos.length === 1,
      "lengths not equal 1",
      "poolKeys.rewardInfos",
      poolKeys.rewardInfos,
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
      AccountMeta(poolKeys.rewardInfos[0].rewardVault, false),
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
      userKeys.rewardTokenAccounts.length === poolKeys.rewardInfos.length,
      "lengths not equal with params.poolKeys.rewardInfos",
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
      AccountMeta(poolKeys.rewardInfos[0].rewardVault, false),
      // system
      AccountMetaReadonly(SYSVAR_CLOCK_PUBKEY, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
    ];

    for (let index = 1; index < poolKeys.rewardInfos.length; index++) {
      keys.push(AccountMeta(userKeys.rewardTokenAccounts[index], false));
      keys.push(AccountMeta(poolKeys.rewardInfos[index].rewardVault, false));
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

  static makeWithdrawInstructionV6({ poolKeys, userKeys, amount }: FarmWithdrawInstructionParams) {
    logger.assertArgument(
      userKeys.rewardTokenAccounts.length !== 0,
      "lengths equal zero",
      "userKeys.rewardTokenAccounts",
      userKeys.rewardTokenAccounts,
    );
    logger.assertArgument(
      userKeys.rewardTokenAccounts.length === poolKeys.rewardInfos.length,
      "lengths not equal with params.poolKeys.rewardInfos",
      "userKeys.rewardTokenAccounts",
      userKeys.rewardTokenAccounts,
    );

    const LAYOUT = struct([u8("instruction"), u64("amount")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 2,
        amount: parseBigNumberish(amount),
      },
      data,
    );

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),

      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMeta(poolKeys.lpVault, false),
      AccountMeta(userKeys.ledger, false),
      AccountMetaReadonly(userKeys.owner, true),
      AccountMeta(userKeys.lpTokenAccount, false),
    ];

    for (let index = 0; index < poolKeys.rewardInfos.length; index++) {
      keys.push(AccountMeta(poolKeys.rewardInfos[index].rewardVault, false));
      keys.push(AccountMeta(userKeys.rewardTokenAccounts[index], false));
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

  static makeCreateFarmInstruction({
    connection,
    owner,
    payer,
    poolInfo,
    lockInfo,
  }: {
    connection: Connection;
    owner: PublicKey;
    payer: PublicKey;
    poolInfo: FarmCreateInstructionParams;
    lockInfo?: FarmLockInfo;
  }) {
    const { version } = poolInfo;

    if (version === 6) {
      return this.makeCreateFarmInstructionV6({
        connection,
        owner,
        payer,
        poolInfo,
        lockInfo,
      });
    }

    return logger.throwArgumentError("invalid version", "version", version);
  }

  static async makeCreateFarmInstructionV6({
    connection,
    owner,
    payer,
    poolInfo,
    lockInfo,
  }: {
    connection: Connection;
    owner: PublicKey;
    payer: PublicKey;
    poolInfo: FarmCreateInstructionParamsV6;
    lockInfo?: FarmLockInfo;
  }) {
    logger.assertArgument(lockInfo, "need lockInfo", "lockInfo", lockInfo);
    if (!lockInfo) return;

    const instructions: TransactionInstruction[] = [];

    const farmId = Keypair.generate();
    const lamports = await connection.getMinimumBalanceForRentExemption(FARM_STATE_LAYOUT_V6.span);

    instructions.push(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: farmId.publicKey,
        lamports,
        space: FARM_STATE_LAYOUT_V6.span,
        programId: poolInfo.programId,
      }),
    );

    const { publicKey: authority, nonce } = await Farm.getAssociatedAuthority({
      programId: poolInfo.programId,
      poolId: farmId.publicKey,
    });

    const lpVault = await Farm.getAssociatedLedgerPoolAccount({
      programId: poolInfo.programId,
      poolId: farmId.publicKey,
      mint: poolInfo.lpMint,
      type: "lpVault",
    });

    const lockVault = await Farm.getAssociatedLedgerPoolAccount({
      programId: poolInfo.programId,
      poolId: farmId.publicKey,
      mint: lockInfo.lockMint,
      type: "lockVault",
    });

    const rewardInfoConfig: {
      isSet: BN;
      rewardPerSecond: BN;
      rewardOpenTime: BN;
      rewardEndTime: BN;
    }[] = [];
    const rewardInfoKey: {
      rewardMint: PublicKey;
      rewardVault: PublicKey;
      userRewardToken: PublicKey;
    }[] = [];

    for (const rewardInfo of poolInfo.rewardInfos) {
      logger.assertArgument(
        rewardInfo.rewardStartTime < new Date().getTime(),
        "start time < now time",
        "rewardInfo.rewardStartTime",
        rewardInfo.rewardStartTime,
      );
      logger.assertArgument(
        rewardInfo.rewardStartTime < rewardInfo.rewardEndTime,
        "start time error",
        "rewardInfo.rewardStartTime",
        rewardInfo.rewardStartTime,
      );
      rewardInfoConfig.push({
        isSet: new BN(1),
        rewardPerSecond: parseBigNumberish(rewardInfo.rewardPerSecond),
        rewardOpenTime: parseBigNumberish(rewardInfo.rewardStartTime),
        rewardEndTime: parseBigNumberish(rewardInfo.rewardEndTime),
      });

      rewardInfoKey.push({
        rewardMint: rewardInfo.rewardMint,
        rewardVault: await Farm.getAssociatedLedgerPoolAccount({
          programId: poolInfo.programId,
          poolId: farmId.publicKey,
          mint: rewardInfo.rewardMint,
          type: "rewardVault",
        }),
        userRewardToken: rewardInfo.rewardOwnerAccount,
      });
    }

    const rewardTimeInfo = struct([u64("isSet"), u64("rewardPerSecond"), u64("rewardOpenTime"), u64("rewardEndTime")]);

    const LAYOUT = struct([u8("instruction"), u64("nonce"), seq(rewardTimeInfo, 5, "rewardTimeInfo")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 0,
        nonce: new BN(nonce),
        rewardTimeInfo: rewardInfoConfig,
      },
      data,
    );

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
      AccountMetaReadonly(SYSTEM_PROGRAM_ID, false),
      AccountMetaReadonly(SYSVAR_RENT_PUBKEY, false),

      AccountMeta(farmId.publicKey, false),
      AccountMetaReadonly(authority, false),
      AccountMeta(lpVault, false),
      AccountMetaReadonly(poolInfo.lpMint, false),
      AccountMeta(lockVault, false),
      AccountMetaReadonly(lockInfo.lockMint, false),
      AccountMeta(lockInfo.userLockAccount, false),
      AccountMetaReadonly(owner, true),
    ];

    for (const item of rewardInfoKey) {
      keys.push(
        ...[
          { pubkey: item.rewardMint, isSigner: false, isWritable: false },
          { pubkey: item.rewardVault, isSigner: false, isWritable: true },
          { pubkey: item.userRewardToken, isSigner: false, isWritable: true },
        ],
      );
    }

    instructions.push(
      new TransactionInstruction({
        programId: poolInfo.programId,
        keys,
        data,
      }),
    );
    return { newAccount: farmId, instructions };
  }

  static makeRestartFarmInstruction(params: FarmRestartInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 6) {
      return this.makeRestartFarmInstructionV6(params);
    }

    return logger.throwArgumentError("invalid version", "version", version);
  }

  static makeRestartFarmInstructionV6({
    poolKeys,
    rewardOwner,
    rewardVault,
    rewardOwnerAccount,
    rewardRestartTime,
    rewardEndTime,
    rewardPerSecond,
  }: FarmRestartInstructionParams) {
    logger.assertArgument(
      rewardRestartTime < new Date().getTime(),
      "start time < now time",
      "rewardRestartTime",
      rewardRestartTime,
    );
    logger.assertArgument(
      rewardRestartTime < rewardEndTime,
      "start time error",
      "rewardRestartTime",
      rewardRestartTime,
    );

    const LAYOUT = struct([u8("instruction"), u64("rewardRestartTime"), u64("rewardEndTime"), u64("rewardPerSecond")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 3,
        rewardRestartTime: parseBigNumberish(rewardRestartTime),
        rewardEndTime: parseBigNumberish(rewardEndTime),
        rewardPerSecond: parseBigNumberish(rewardPerSecond),
      },
      data,
    );

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),

      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.lpVault, false),
      AccountMeta(rewardVault, false),
      AccountMeta(rewardOwnerAccount, false),
      AccountMetaReadonly(rewardOwner, true),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  static makeWithdrawFarmRewardInstruction(params: FarmWithdrawRewardInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 6) {
      return this.makeWithdrawFarmRewardInstructionV6(params);
    }

    return logger.throwArgumentError("invalid version", "version", version);
  }

  static makeWithdrawFarmRewardInstructionV6({
    poolKeys,
    owner,
    rewardVault,
    userVault,
  }: FarmWithdrawRewardInstructionParamsV6) {
    const LAYOUT = struct([u8("instruction")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode({ instruction: 5 }, data);

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),

      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMetaReadonly(poolKeys.lpVault, false),
      AccountMeta(rewardVault, false),
      AccountMeta(userVault, false),
      AccountMetaReadonly(owner, true),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  static makeFarmCreatorAddRewardTokenInstruction(params: FarmCreatorAddRewardTokenInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 6) {
      return this.makeFarmCreatorAddRewardTokenInstructionV6(params);
    }

    return logger.throwArgumentError("invalid version", "version", version);
  }

  static async makeFarmCreatorAddRewardTokenInstructionV6({
    poolKeys,
    owner,
    newRewardInfo,
  }: FarmCreatorAddRewardTokenInstructionParams) {
    const rewardVault = await Farm.getAssociatedLedgerPoolAccount({
      programId: poolKeys.programId,
      poolId: poolKeys.id,
      mint: newRewardInfo.rewardMint,
      type: "rewardVault",
    });

    const LAYOUT = struct([
      u8("instruction"),
      u64("isSet"),
      u64("rewardPerSecond"),
      u64("rewardStartTime"),
      u64("rewardEndTime"),
    ]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 4,
        isSet: new BN(1),
        rewardPerSecond: parseBigNumberish(newRewardInfo.rewardPerSecond),
        rewardStartTime: parseBigNumberish(newRewardInfo.rewardStartTime),
        rewardEndTime: parseBigNumberish(newRewardInfo.rewardEndTime),
      },
      data,
    );

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
      AccountMetaReadonly(SYSTEM_PROGRAM_ID, false),
      AccountMetaReadonly(SYSVAR_RENT_PUBKEY, false),

      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMetaReadonly(newRewardInfo.rewardMint, false),
      AccountMeta(rewardVault, false),
      AccountMeta(newRewardInfo.rewardOwnerAccount, false),
      AccountMetaReadonly(owner, true),
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
        version: number;
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

      poolsInfo[_poolId].version = version;
    }

    // wrapped data
    for (const [poolId, { state, ledger, version }] of Object.entries(poolsInfo)) {
      if (ledger) {
        if (version === 3 || version === 4 || version === 5) {
          let multiplier = TEN.pow(new BN(15));
          // for stake pool
          if ((state as FarmStateV3 | FarmStateV5).rewardInfos.length === 1) {
            multiplier = TEN.pow(new BN(9));
          }

          const pendingRewards = (state as FarmStateV3 | FarmStateV5).rewardInfos.map((itemRewardInfo, index) => {
            const rewardDebt = (ledger as FarmLedgerOld).rewardDebts[index];
            const pendingReward = (ledger as FarmLedgerOld).deposited
              .mul(itemRewardInfo.perShareReward)
              .div(multiplier)
              .sub(rewardDebt);

            return pendingReward;
          });

          poolsInfo[poolId].wrapped = {
            ...poolsInfo[poolId].wrapped,
            pendingRewards,
          };
        } else if (version === 6) {
          const multiplier = (state as FarmStateV6).rewardMultiplier;

          const pendingRewards = (state as FarmStateV6).rewardInfos.map((rewardInfo, index) => {
            const rewardDebt = (ledger as FarmLedgerV6_1).rewardDebts[index];
            const pendingReward = (ledger as FarmLedgerV6_1).deposited
              .mul(rewardInfo.accRewardPerShare)
              .div(multiplier)
              .sub(rewardDebt);

            return pendingReward;
          });

          poolsInfo[poolId].wrapped = {
            ...poolsInfo[poolId].wrapped,
            pendingRewards,
          };
        }
      }
    }

    return poolsInfo;
  }
}
