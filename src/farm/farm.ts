import { Connection, Keypair, PublicKey, Signer, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { Base, TokenAccount } from "../base";
import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, GetMultipleAccountsInfoConfig,
  getMultipleAccountsInfoWithCustomFlags, Logger, PublicKeyish, SYSTEM_PROGRAM_ID, SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY, TOKEN_PROGRAM_ID, validateAndParsePublicKey,
} from "../common";
import { BigNumberish, parseBigNumberish, TEN, Token } from "../entity";
import { seq, struct, u64, u8 } from "../marshmallow";
import { Spl, SPL_ACCOUNT_LAYOUT, SplAccount } from "../spl";

import { FARM_PROGRAMID_TO_VERSION, FARM_VERSION_TO_PROGRAMID } from "./id";
import {
  FARM_STATE_LAYOUT_V6, FARM_VERSION_TO_LEDGER_LAYOUT, FARM_VERSION_TO_STATE_LAYOUT, FarmLedger, FarmState,
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
        readonly rewardOpenTime: number;
        readonly rewardEndTime: number;
        readonly rewardPerSecond: number;
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

export interface FarmRewardInfo {
  rewardMint: PublicKey;
  rewardPerSecond: BigNumberish;
  rewardOpenTime: BigNumberish;
  rewardEndTime: BigNumberish;
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
    rewardPerSecond: BigNumberish;
    rewardOpenTime: BigNumberish;
    rewardEndTime: BigNumberish;
  }[];

  lockInfo: {
    lockMint: PublicKey;
    lockVault: PublicKey;
  };
}

export type FarmCreateInstructionParams = FarmCreateInstructionParamsV6;

export interface FarmRestartInstructionParamsV6 {
  connection: Connection;
  poolKeys: FarmPoolKeys;
  userKeys: {
    tokenAccounts: TokenAccount[];
    owner: PublicKey;
    payer?: PublicKey;
  };

  newRewardInfo: FarmRewardInfo;
}

export type FarmRestartInstructionParams = FarmRestartInstructionParamsV6;
export interface FarmCreatorWithdrawRewardInstructionParamsV6 {
  connection: Connection;
  poolKeys: FarmPoolKeys;
  userKeys: {
    tokenAccounts: TokenAccount[];
    owner: PublicKey;
    payer?: PublicKey;
  };

  withdrawMint: PublicKey;
}

export type FarmCreatorWithdrawRewardInstructionParams = FarmCreatorWithdrawRewardInstructionParamsV6;

export interface FarmCreatorAddRewardTokenInstructionParamsV6 {
  connection: Connection;
  poolKeys: FarmPoolKeys;
  userKeys: {
    tokenAccounts: TokenAccount[];
    owner: PublicKey;
    payer?: PublicKey;
  };

  newRewardInfo: FarmRewardInfo;
}

export type FarmCreatorAddRewardTokenInstructionParams = FarmCreatorAddRewardTokenInstructionParamsV6;

export interface makeCreateFarmInstructionParamsV6 {
  connection: Connection;
  userKeys: {
    tokenAccounts: TokenAccount[];
    owner: PublicKey;
    payer?: PublicKey;
  };
  poolInfo: FarmCreateInstructionParams;
}
export type makeCreateFarmInstructionParams = makeCreateFarmInstructionParamsV6;

/* ================= fetch data ================= */
export interface FarmFetchMultipleInfoParams {
  connection: Connection;
  pools: FarmPoolKeys[];
  owner?: PublicKey;
  config?: GetMultipleAccountsInfoConfig;
}

export class Farm extends Base {
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
    type: "lpVault" | "rewardVault";
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
      AccountMeta(userKeys.ledger, false),
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
      AccountMeta(userKeys.ledger, false),
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

  static makeCreateFarmInstruction({ connection, userKeys, poolInfo }: makeCreateFarmInstructionParams) {
    const { version } = poolInfo;

    if (version === 6) {
      return this.makeCreateFarmInstructionV6({
        connection,
        userKeys,
        poolInfo,
      });
    }

    return logger.throwArgumentError("invalid version", "version", version);
  }

  static async makeCreateFarmInstructionV6({ connection, userKeys, poolInfo }: makeCreateFarmInstructionParamsV6) {
    const farmId = Keypair.generate();
    const lamports = await connection.getMinimumBalanceForRentExemption(FARM_STATE_LAYOUT_V6.span);

    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];
    const signers: Signer[] = [farmId];

    frontInstructions.push(
      SystemProgram.createAccount({
        fromPubkey: userKeys.payer ?? userKeys.owner,
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
        rewardInfo.rewardOpenTime < rewardInfo.rewardEndTime,
        "start time error",
        "rewardInfo.rewardOpenTime",
        rewardInfo.rewardOpenTime,
      );
      rewardInfoConfig.push({
        isSet: new BN(1),
        rewardPerSecond: parseBigNumberish(rewardInfo.rewardPerSecond),
        rewardOpenTime: parseBigNumberish(rewardInfo.rewardOpenTime),
        rewardEndTime: parseBigNumberish(rewardInfo.rewardEndTime),
      });

      let userRewardToken;
      if (rewardInfo.rewardMint.equals(PublicKey.default)) {
        // SOL
        userRewardToken = await Spl.insertCreateWrappedNativeAccountInstructions({
          connection,
          owner: userKeys.owner,
          payer: userKeys.payer ?? userKeys.owner,
          instructions: frontInstructions,
          signers,
          amount: parseBigNumberish(rewardInfo.rewardEndTime)
            .sub(parseBigNumberish(rewardInfo.rewardOpenTime))
            .mul(parseBigNumberish(rewardInfo.rewardPerSecond)),
        });
        endInstructions.push(
          Spl.makeCloseAccountInstruction({
            tokenAccount: userRewardToken,
            owner: userKeys.owner,
            payer: userKeys.payer ?? userKeys.owner,
          }),
        );
      } else {
        userRewardToken = await this._selectTokenAccount({
          tokenAccounts: userKeys.tokenAccounts,
          mint: rewardInfo.rewardMint,
          owner: userKeys.owner,
          config: { associatedOnly: false },
        });
      }

      logger.assertArgument(
        userRewardToken !== null,
        "cannot found target token accounts",
        "tokenAccounts",
        userKeys.tokenAccounts,
      );

      const rewardMint = rewardInfo.rewardMint.equals(PublicKey.default) ? Token.WSOL.mint : rewardInfo.rewardMint;
      rewardInfoKey.push({
        rewardMint,
        rewardVault: await Farm.getAssociatedLedgerPoolAccount({
          programId: poolInfo.programId,
          poolId: farmId.publicKey,
          mint: rewardMint,
          type: "rewardVault",
        }),
        userRewardToken,
      });
    }

    const lockUserAccount = await this._selectTokenAccount({
      tokenAccounts: userKeys.tokenAccounts,
      mint: poolInfo.lockInfo.lockMint,
      owner: userKeys.owner,
      config: { associatedOnly: false },
    });

    logger.assertArgument(lockUserAccount !== null, "cannot found lock vault", "tokenAccounts", userKeys.tokenAccounts);

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
      AccountMeta(poolInfo.lockInfo.lockVault, false),
      AccountMetaReadonly(poolInfo.lockInfo.lockMint, false),
      AccountMeta(lockUserAccount ?? PublicKey.default, false),
      AccountMetaReadonly(userKeys.owner, true),
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

    frontInstructions.push(
      new TransactionInstruction({
        programId: poolInfo.programId,
        keys,
        data,
      }),
    );

    return { newAccounts: signers, instructions: [...frontInstructions, ...endInstructions] };
  }

  static makeRestartFarmInstruction(params: FarmRestartInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 6) {
      return this.makeRestartFarmInstructionV6(params);
    }

    return logger.throwArgumentError("invalid version", "version", version);
  }

  static async makeRestartFarmInstructionV6({
    connection,
    poolKeys,
    userKeys,
    newRewardInfo,
  }: FarmRestartInstructionParamsV6) {
    logger.assertArgument(
      newRewardInfo.rewardOpenTime < newRewardInfo.rewardEndTime,
      "start time error",
      "newRewardInfo",
      newRewardInfo,
    );
    const rewardMint = newRewardInfo.rewardMint.equals(PublicKey.default) ? Token.WSOL.mint : newRewardInfo.rewardMint;
    const rewardInfo = poolKeys.rewardInfos.find((item) => item.rewardMint.equals(rewardMint));

    logger.assertArgument(rewardInfo, "configuration does not exist", "rewardInfo", rewardInfo);

    const rewardVault = rewardInfo?.rewardVault ?? PublicKey.default;

    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];
    const signers: Signer[] = [];

    let userRewardToken;
    if (newRewardInfo.rewardMint.equals(PublicKey.default)) {
      // SOL
      userRewardToken = await Spl.insertCreateWrappedNativeAccountInstructions({
        connection,
        owner: userKeys.owner,
        payer: userKeys.payer ?? userKeys.owner,
        instructions: frontInstructions,
        signers,
        amount: parseBigNumberish(newRewardInfo.rewardEndTime)
          .sub(parseBigNumberish(newRewardInfo.rewardOpenTime))
          .mul(parseBigNumberish(newRewardInfo.rewardPerSecond)),
      });
      endInstructions.push(
        Spl.makeCloseAccountInstruction({
          tokenAccount: userRewardToken,
          owner: userKeys.owner,
          payer: userKeys.payer ?? userKeys.owner,
        }),
      );
    } else {
      userRewardToken = await this._selectTokenAccount({
        tokenAccounts: userKeys.tokenAccounts,
        mint: newRewardInfo.rewardMint,
        owner: userKeys.owner,
        config: { associatedOnly: false },
      });
    }

    logger.assertArgument(
      userRewardToken !== null,
      "cannot found target token accounts",
      "tokenAccounts",
      userKeys.tokenAccounts,
    );

    const LAYOUT = struct([u8("instruction"), u64("rewardReopenTime"), u64("rewardEndTime"), u64("rewardPerSecond")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 3,
        rewardReopenTime: parseBigNumberish(newRewardInfo.rewardOpenTime),
        rewardEndTime: parseBigNumberish(newRewardInfo.rewardEndTime),
        rewardPerSecond: parseBigNumberish(newRewardInfo.rewardPerSecond),
      },
      data,
    );

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),

      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.lpVault, false),
      AccountMeta(rewardVault, false),
      AccountMeta(userRewardToken, false),
      AccountMetaReadonly(userKeys.owner, true),
    ];

    frontInstructions.push(
      new TransactionInstruction({
        programId: poolKeys.programId,
        keys,
        data,
      }),
    );

    return { newAccounts: signers, instructions: [...frontInstructions, ...endInstructions] };
  }

  static makeCreatorWithdrawFarmRewardInstruction(params: FarmCreatorWithdrawRewardInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 6) {
      return this.makeCreatorWithdrawFarmRewardInstructionV6(params);
    }

    return logger.throwArgumentError("invalid version", "version", version);
  }

  static async makeCreatorWithdrawFarmRewardInstructionV6({
    connection,
    poolKeys,
    userKeys,
    withdrawMint,
  }: FarmCreatorWithdrawRewardInstructionParamsV6) {
    const rewardInfo = poolKeys.rewardInfos.find((item) =>
      item.rewardMint.equals(withdrawMint.equals(PublicKey.default) ? Token.WSOL.mint : withdrawMint),
    );

    logger.assertArgument(
      rewardInfo !== undefined,
      "withdraw mint error",
      "poolKeys.rewardInfos",
      poolKeys.rewardInfos,
    );

    const rewardVault = rewardInfo?.rewardVault ?? PublicKey.default;

    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];
    const signers: Signer[] = [];

    let userRewardToken: PublicKey;
    if (withdrawMint.equals(PublicKey.default)) {
      // SOL
      userRewardToken = await Spl.insertCreateWrappedNativeAccountInstructions({
        connection,
        owner: userKeys.owner,
        payer: userKeys.payer ?? userKeys.owner,
        instructions: frontInstructions,
        signers,
        amount: 0,
      });
      endInstructions.push(
        Spl.makeCloseAccountInstruction({
          tokenAccount: userRewardToken,
          owner: userKeys.owner,
          payer: userKeys.payer ?? userKeys.owner,
        }),
      );
    } else {
      const selectUserRewardToken = await this._selectTokenAccount({
        tokenAccounts: userKeys.tokenAccounts,
        mint: withdrawMint,
        owner: userKeys.owner,
      });
      if (selectUserRewardToken === null) {
        userRewardToken = await Spl.getAssociatedTokenAccount({ mint: withdrawMint, owner: userKeys.owner });
        frontInstructions.push(
          Spl.makeCreateAssociatedTokenAccountInstruction({
            mint: withdrawMint,
            associatedAccount: userRewardToken,
            owner: userKeys.owner,
            payer: userKeys.payer ?? userKeys.owner,
          }),
        );
      } else {
        userRewardToken = selectUserRewardToken;
      }
    }

    const LAYOUT = struct([u8("instruction")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode({ instruction: 5 }, data);

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),

      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMetaReadonly(poolKeys.lpVault, false),
      AccountMeta(rewardVault, false),
      AccountMeta(userRewardToken, false),
      AccountMetaReadonly(userKeys.owner, true),
    ];

    frontInstructions.push(
      new TransactionInstruction({
        programId: poolKeys.programId,
        keys,
        data,
      }),
    );

    return { newAccounts: signers, instructions: [...frontInstructions, ...endInstructions] };
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
    connection,
    poolKeys,
    userKeys,
    newRewardInfo,
  }: FarmCreatorAddRewardTokenInstructionParamsV6) {
    const rewardVault = await Farm.getAssociatedLedgerPoolAccount({
      programId: poolKeys.programId,
      poolId: poolKeys.id,
      mint: newRewardInfo.rewardMint,
      type: "rewardVault",
    });

    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];
    const signers: Signer[] = [];

    let userRewardToken;
    if (newRewardInfo.rewardMint.equals(PublicKey.default)) {
      // SOL
      userRewardToken = await Spl.insertCreateWrappedNativeAccountInstructions({
        connection,
        owner: userKeys.owner,
        payer: userKeys.payer ?? userKeys.owner,
        instructions: frontInstructions,
        signers,
        amount: parseBigNumberish(newRewardInfo.rewardEndTime)
          .sub(parseBigNumberish(newRewardInfo.rewardOpenTime))
          .mul(parseBigNumberish(newRewardInfo.rewardPerSecond)),
      });
      endInstructions.push(
        Spl.makeCloseAccountInstruction({
          tokenAccount: userRewardToken,
          owner: userKeys.owner,
          payer: userKeys.payer ?? userKeys.owner,
        }),
      );
    } else {
      userRewardToken = await this._selectTokenAccount({
        tokenAccounts: userKeys.tokenAccounts,
        mint: newRewardInfo.rewardMint,
        owner: userKeys.owner,
        config: { associatedOnly: false },
      });
    }

    logger.assertArgument(
      userRewardToken !== null,
      "cannot found target token accounts",
      "tokenAccounts",
      userKeys.tokenAccounts,
    );

    const rewardMint = newRewardInfo.rewardMint.equals(PublicKey.default) ? Token.WSOL.mint : newRewardInfo.rewardMint;

    const LAYOUT = struct([
      u8("instruction"),
      u64("isSet"),
      u64("rewardPerSecond"),
      u64("rewardOpenTime"),
      u64("rewardEndTime"),
    ]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 4,
        isSet: new BN(1),
        rewardPerSecond: parseBigNumberish(newRewardInfo.rewardPerSecond),
        rewardOpenTime: parseBigNumberish(newRewardInfo.rewardOpenTime),
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
      AccountMetaReadonly(rewardMint, false),
      AccountMeta(rewardVault, false),
      AccountMeta(userRewardToken, false),
      AccountMetaReadonly(userKeys.owner, true),
    ];

    frontInstructions.push(
      new TransactionInstruction({
        programId: poolKeys.programId,
        keys,
        data,
      }),
    );

    return { newAccounts: signers, instructions: [...frontInstructions, ...endInstructions] };
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
        let multiplier: BN;
        if (state.version === 6) {
          multiplier = state.rewardMultiplier;
        } else {
          multiplier = state.rewardInfos.length === 1 ? TEN.pow(new BN(9)) : TEN.pow(new BN(15));
        }

        const pendingRewards = state.rewardInfos.map((rewardInfo, index) => {
          const rewardDebt = ledger.rewardDebts[index];
          const pendingReward = ledger.deposited
            .mul(state.version === 6 ? rewardInfo.accRewardPerShare : rewardInfo.perShareReward)
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

    return poolsInfo;
  }

  static async fetchMultipleInfoAndUpdate({ connection, pools, owner, config }: FarmFetchMultipleInfoParams) {
    let hasNotV6Pool = false;
    let hasV6Pool = false;

    const publicKeys: {
      pubkey: PublicKey;
      version: number;
      key: "state" | "lpVault" | "ledger";
      poolId: PublicKey;
    }[] = [];

    for (const pool of pools) {
      if (pool.version === 6) hasV6Pool = true;
      else hasNotV6Pool = true;

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

    const slot = hasV6Pool || hasNotV6Pool ? await connection.getSlot() : 0;
    const chainTime = hasV6Pool ? (await connection.getBlockTime(slot)) ?? 0 : 0;

    for (const poolId of Object.keys(poolsInfo)) {
      poolsInfo[poolId].state = Farm.updatePoolInfo(
        poolsInfo[poolId].state,
        poolsInfo[poolId].lpVault,
        slot,
        chainTime,
      );
    }

    // wrapped data
    for (const [poolId, { state, ledger }] of Object.entries(poolsInfo)) {
      if (ledger) {
        let multiplier: BN;
        if (state.version === 6) {
          multiplier = state.rewardMultiplier;
        } else {
          multiplier = state.rewardInfos.length === 1 ? TEN.pow(new BN(9)) : TEN.pow(new BN(15));
        }

        const pendingRewards = state.rewardInfos.map((rewardInfo, index) => {
          const rewardDebt = ledger.rewardDebts[index];
          const pendingReward = ledger.deposited
            .mul(state.version === 6 ? rewardInfo.accRewardPerShare : rewardInfo.perShareReward)
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

    return poolsInfo;
  }

  static updatePoolInfo(poolInfo: FarmState, lpVault: SplAccount, slot: number, chainTime: number) {
    if (poolInfo.version === 3 || poolInfo.version === 5) {
      if (poolInfo.lastSlot.gte(new BN(slot))) return poolInfo;

      const spread = new BN(slot).sub(poolInfo.lastSlot);
      poolInfo.lastSlot = new BN(slot);

      for (const itemRewardInfo of poolInfo.rewardInfos) {
        if (lpVault.amount.eq(new BN(0))) continue;

        const reward = itemRewardInfo.perSlotReward.mul(spread);
        itemRewardInfo.perShareReward = itemRewardInfo.perShareReward.add(
          reward.mul(new BN(10).pow(new BN(poolInfo.version === 3 ? 9 : 15))).div(lpVault.amount),
        );
        itemRewardInfo.totalReward = itemRewardInfo.totalReward.add(reward);
      }
    } else if (poolInfo.version === 6) {
      for (const itemRewardInfo of poolInfo.rewardInfos) {
        if (itemRewardInfo.rewardState.eq(new BN(0))) continue;
        const updateTime = BN.min(new BN(chainTime), itemRewardInfo.rewardEndTime);
        if (itemRewardInfo.rewardOpenTime.gte(updateTime)) continue;
        const spread = updateTime.sub(itemRewardInfo.rewardLastUpdateTime);
        let reward = spread.mul(itemRewardInfo.rewardPerSecond);
        const leftReward = itemRewardInfo.totalReward.sub(itemRewardInfo.totalRewardEmissioned);
        if (leftReward.lt(reward)) {
          reward = leftReward;
          itemRewardInfo.rewardLastUpdateTime = itemRewardInfo.rewardLastUpdateTime.add(
            leftReward.div(itemRewardInfo.rewardPerSecond),
          );
        } else {
          itemRewardInfo.rewardLastUpdateTime = updateTime;
        }
        if (lpVault.amount.eq(new BN(0))) continue;
        itemRewardInfo.accRewardPerShare = itemRewardInfo.accRewardPerShare.add(
          reward.mul(poolInfo.rewardMultiplier).div(lpVault.amount),
        );
        itemRewardInfo.totalRewardEmissioned = itemRewardInfo.totalRewardEmissioned.add(reward);
      }
    }
    return poolInfo;
  }
}
