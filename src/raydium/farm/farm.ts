import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AccountMeta,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";

import { accountMeta, AddInstructionParam, commonSystemAccountMeta, parseBigNumberish, TxBuilder } from "../../common";
import { PublicKeyish, SOLMint, validateAndParsePublicKey } from "../../common/pubKey";
import { createWrappedNativeAccountInstructions } from "../account/instruction";
import ModuleBase from "../moduleBase";
import { TOKEN_WSOL } from "../token/constant";
import { MakeTransaction } from "../type";

import {
  FARM_LOCK_MINT,
  FARM_LOCK_VAULT,
  farmDespotVersionToInstruction,
  farmWithdrawVersionToInstruction,
  isValidFarmVersion,
  validateFarmRewards,
} from "./config";
import { createAssociatedLedgerAccountInstruction } from "./instruction";
import {
  dwLayout,
  farmAddRewardLayout,
  farmRewardLayout,
  farmRewardRestartLayout,
  farmStateV6Layout,
  withdrawRewardLayout,
} from "./layout";
import {
  FarmDWParam,
  FarmPoolJsonInfo,
  FarmRewardInfo,
  FarmRewardInfoConfig,
  RewardInfoKey,
  RewardSetParam,
  SdkParsedFarmInfo,
} from "./type";
import {
  calFarmRewardAmount,
  farmInfoStringToPubKey,
  farmRewardInfoToConfig,
  getAssociatedAuthority,
  getAssociatedLedgerAccount,
  getAssociatedLedgerPoolAccount,
  getFarmProgramId,
  mergeSdkFarmInfo,
} from "./util";

export default class Farm extends ModuleBase {
  private _farmPools: FarmPoolJsonInfo[] = [];
  private _sdkParsedFarmPools: SdkParsedFarmInfo[] = [];

  public async load(): Promise<void> {
    await this.scope.liquidity.load();
    await this.scope.fetchFarms();

    this._farmPools = Object.keys(this.scope.apiData.farmPools || {}).reduce(
      (acc, cur) => acc.concat(this.scope.apiData.farmPools![cur].map((data) => ({ ...data, category: cur }))),
      [],
    );

    this._sdkParsedFarmPools = await mergeSdkFarmInfo(
      {
        connection: this.scope.connection,
        pools: this._farmPools.map(farmInfoStringToPubKey),
        owner: this.scope.ownerPubKey,
        config: { commitment: "confirmed" },
      },
      { jsonInfos: this._farmPools },
    );
  }

  get allFarms(): FarmPoolJsonInfo[] {
    return this._farmPools;
  }
  get allParsedFarms(): SdkParsedFarmInfo[] {
    return this._sdkParsedFarmPools;
  }

  public getFarm(farmId: PublicKeyish): FarmPoolJsonInfo {
    const _farmId = validateAndParsePublicKey(farmId);
    const farmInfo = this.allFarms.find((farm) => farm.id === _farmId.toBase58());
    if (!farmInfo) this.logAndCreateError("invalid farm id");
    return farmInfo!;
  }
  public getParsedFarm(farmId: PublicKeyish): SdkParsedFarmInfo {
    const _farmId = validateAndParsePublicKey(farmId);
    const farmInfo = this.allParsedFarms.find((farm) => _farmId.equals(farm.id));
    if (!farmInfo) this.logAndCreateError("invalid farm id");
    return farmInfo!;
  }

  // token account needed
  private async _getUserRewardInfo({ payer, rewardInfo }: { payer: PublicKey; rewardInfo: FarmRewardInfo }): Promise<{
    rewardPubKey?: PublicKey;
    newInstruction?: AddInstructionParam;
  }> {
    if (rewardInfo.rewardMint.equals(SOLMint)) {
      const txInstructions = await createWrappedNativeAccountInstructions({
        connection: this.scope.connection,
        owner: this.scope.ownerPubKey,
        payer,
        amount: calFarmRewardAmount(rewardInfo),
      });
      return {
        rewardPubKey: txInstructions.signers![0].publicKey,
        newInstruction: txInstructions,
      };
    }

    return {
      rewardPubKey: await this.scope.account.getCreatedTokenAccount({
        mint: rewardInfo.rewardMint,
      })!,
    };
  }

  // token account needed
  public async create({ poolId, rewardInfos, payer }: RewardSetParam): Promise<MakeTransaction> {
    this.checkDisabled();
    this.scope.checkOwner();

    const poolJsonInfo = this.scope.liquidity.allPools.find((j) => j.id === poolId?.toBase58());
    if (!poolJsonInfo) this.logAndCreateError("invalid pool id");

    const lpMint = new PublicKey(poolJsonInfo!.lpMint);
    const poolInfo = {
      lpMint,
      lockInfo: { lockMint: FARM_LOCK_MINT, lockVault: FARM_LOCK_VAULT },
      version: 6,
      rewardInfos,
      programId: getFarmProgramId(6)!,
    };

    const txBuilder = this.createTxBuilder();
    const payerPubKey = payer ?? this.scope.ownerPubKey;
    const farmKeyPair = Keypair.generate();
    const lamports = await this.scope.connection.getMinimumBalanceForRentExemption(farmStateV6Layout.span);

    txBuilder.addInstruction({
      instructions: [
        SystemProgram.createAccount({
          fromPubkey: payerPubKey,
          newAccountPubkey: farmKeyPair.publicKey,
          lamports,
          space: farmStateV6Layout.span,
          programId: poolInfo.programId,
        }),
      ],
      signers: [farmKeyPair],
    });

    const { publicKey: authority, nonce } = await getAssociatedAuthority({
      programId: poolInfo.programId,
      poolId: farmKeyPair.publicKey,
    });

    const lpVault = await getAssociatedLedgerPoolAccount({
      programId: poolInfo.programId,
      poolId: farmKeyPair.publicKey,
      mint: poolInfo.lpMint,
      type: "lpVault",
    });

    const rewardInfoConfig: FarmRewardInfoConfig[] = [];
    const rewardInfoKey: RewardInfoKey[] = [];

    for (const rewardInfo of poolInfo.rewardInfos) {
      if (rewardInfo.rewardOpenTime >= rewardInfo.rewardEndTime)
        this.logAndCreateError("start time error", "rewardInfo.rewardOpenTime", rewardInfo.rewardOpenTime.toString());
      rewardInfoConfig.push(farmRewardInfoToConfig(rewardInfo));

      const { rewardPubKey, newInstruction } = await this._getUserRewardInfo({
        rewardInfo,
        payer: payerPubKey,
      });
      if (newInstruction) txBuilder.addInstruction(newInstruction);

      if (!rewardPubKey) this.logAndCreateError("cannot found target token accounts", this.scope.account.tokenAccounts);

      const rewardMint = rewardInfo.rewardMint.equals(SOLMint) ? new PublicKey(TOKEN_WSOL.mint) : rewardInfo.rewardMint;
      rewardInfoKey.push({
        rewardMint,
        rewardVault: await getAssociatedLedgerPoolAccount({
          programId: poolInfo.programId,
          poolId: farmKeyPair.publicKey,
          mint: rewardMint,
          type: "rewardVault",
        }),
        userRewardToken: rewardPubKey!,
      });
    }

    const lockUserAccount = await this.scope.account.getCreatedTokenAccount({
      mint: poolInfo.lockInfo.lockMint,
    });

    if (!lockUserAccount)
      this.logAndCreateError("cannot found lock vault", "tokenAccounts", this.scope.account.tokenAccounts);

    const data = Buffer.alloc(farmRewardLayout.span);
    farmRewardLayout.encode(
      {
        instruction: 0,
        nonce: new BN(nonce),
        rewardTimeInfo: rewardInfoConfig,
      },
      data,
    );

    const keys = [
      ...commonSystemAccountMeta,
      accountMeta({ pubkey: farmKeyPair.publicKey }),
      accountMeta({ pubkey: authority, isWritable: false }),
      accountMeta({ pubkey: lpVault }),
      accountMeta({ pubkey: poolInfo.lpMint, isWritable: false }),
      accountMeta({ pubkey: poolInfo.lockInfo.lockVault }),
      accountMeta({ pubkey: poolInfo.lockInfo.lockMint, isWritable: false }),
      accountMeta({ pubkey: lockUserAccount ?? SOLMint }),
      accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
    ];

    for (const item of rewardInfoKey) {
      keys.push(
        ...[
          accountMeta({ pubkey: item.rewardMint, isWritable: false }),
          accountMeta({ pubkey: item.rewardVault }),
          accountMeta({ pubkey: item.userRewardToken }),
        ],
      );
    }

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: poolInfo.programId, keys, data })],
      })
      .build();
  }

  // token account needed
  public async restartReward({
    farmId,
    payer,
    newRewardInfo,
  }: {
    farmId: PublicKey;
    newRewardInfo: FarmRewardInfo;
    payer?: PublicKey;
  }): Promise<MakeTransaction> {
    const farmInfo = this.getFarm(farmId)!;
    if (farmInfo!.version !== 6) this.logAndCreateError("invalid farm version", farmInfo!.version);

    const poolKeys = {
      id: new PublicKey(farmInfo.id),
      rewardInfos: farmInfo.rewardInfos,
      lpVault: new PublicKey(farmInfo.lpVault),
      programId: new PublicKey(farmInfo.programId),
    };

    if (newRewardInfo.rewardOpenTime >= newRewardInfo.rewardEndTime)
      this.logAndCreateError("start time error", "newRewardInfo", newRewardInfo);

    const payerPubKey = payer || this.scope.ownerPubKey;

    const rewardMint = newRewardInfo.rewardMint.equals(SOLMint)
      ? new PublicKey(TOKEN_WSOL.mint)
      : newRewardInfo.rewardMint;
    const rewardInfo = poolKeys.rewardInfos.find((item) => new PublicKey(item.rewardMint).equals(rewardMint));

    if (!rewardInfo) this.logAndCreateError("configuration does not exist", "rewardMint", rewardMint);

    const rewardVault = rewardInfo!.rewardVault ? new PublicKey(rewardInfo!.rewardVault) : SOLMint;
    const txBuilder = this.createTxBuilder();

    const { rewardPubKey: userRewardTokenPub, newInstruction } = await this._getUserRewardInfo({
      rewardInfo: newRewardInfo,
      payer: payerPubKey,
    });
    if (newInstruction) txBuilder.addInstruction(newInstruction);

    if (!userRewardTokenPub)
      this.logAndCreateError("cannot found target token accounts", this.scope.account.tokenAccounts);

    const data = Buffer.alloc(farmRewardRestartLayout.span);
    farmRewardRestartLayout.encode(
      {
        instruction: 3,
        rewardReopenTime: parseBigNumberish(newRewardInfo.rewardOpenTime),
        rewardEndTime: parseBigNumberish(newRewardInfo.rewardEndTime),
        rewardPerSecond: parseBigNumberish(newRewardInfo.rewardPerSecond),
      },
      data,
    );

    const keys = [
      accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
      accountMeta({ pubkey: poolKeys.id }),
      accountMeta({ pubkey: poolKeys.lpVault, isWritable: false }),
      accountMeta({ pubkey: rewardVault }),
      accountMeta({ pubkey: userRewardTokenPub! }),
      accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
    ];

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: poolKeys.programId, keys, data })],
      })
      .build();
  }

  // token account needed
  public async addNewRewardToken(params: {
    farmId: PublicKey;
    payer?: PublicKey;
    newRewardInfo: FarmRewardInfo;
  }): Promise<MakeTransaction> {
    const { farmId, newRewardInfo, payer } = params;
    const farmInfo = this.getFarm(farmId)!;
    if (farmInfo!.version !== 6) this.logAndCreateError("invalid farm version", farmInfo!.version);
    const payerPubKey = payer ?? this.scope.ownerPubKey;
    const txBuilder = this.createTxBuilder();

    const rewardVault = await getAssociatedLedgerPoolAccount({
      programId: new PublicKey(farmInfo.programId),
      poolId: new PublicKey(farmInfo.id),
      mint: newRewardInfo.rewardMint,
      type: "rewardVault",
    });

    const { rewardPubKey: userRewardTokenPub, newInstruction } = await this._getUserRewardInfo({
      rewardInfo: newRewardInfo,
      payer: payerPubKey,
    });
    if (newInstruction) txBuilder.addInstruction(newInstruction);

    if (!userRewardTokenPub)
      this.logAndCreateError("annot found target token accounts", this.scope.account.tokenAccounts);

    const rewardMint = newRewardInfo.rewardMint.equals(SOLMint)
      ? new PublicKey(TOKEN_WSOL.mint)
      : newRewardInfo.rewardMint;
    const data = Buffer.alloc(farmAddRewardLayout.span);
    farmAddRewardLayout.encode(
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
      ...commonSystemAccountMeta,
      accountMeta({ pubkey: new PublicKey(farmInfo.id) }),
      accountMeta({ pubkey: new PublicKey(farmInfo.authority), isWritable: false }),
      accountMeta({ pubkey: rewardMint, isWritable: false }),
      accountMeta({ pubkey: rewardVault }),
      accountMeta({ pubkey: userRewardTokenPub! }),
      accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
    ];

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: new PublicKey(farmInfo.programId), keys, data })],
      })
      .build();
  }

  private async _prepareFarmAccounts(params: { mint: PublicKey; farmInfo: SdkParsedFarmInfo }): Promise<{
    txBuilder: TxBuilder;
    lpTokenAccount: PublicKey;
    ledgerAddress: PublicKey;
    rewardTokenAccountsPublicKeys: PublicKey[];
    lowVersionKeys: AccountMeta[];
  }> {
    const txBuilder = this.createTxBuilder();
    const { mint, farmInfo } = params;

    const { pubKey: lpTokenAccount, newInstructions } = await this.scope.account.checkOrCreateAta({
      mint,
    });
    txBuilder.addInstruction(newInstructions);

    const rewardTokenAccountsPublicKeys = await Promise.all(
      farmInfo.rewardInfos.map(async ({ rewardMint }) => {
        const { pubKey, newInstructions } = await this.scope.account.checkOrCreateAta({
          mint: rewardMint,
          autoUnwrapWSOLToSOL: true,
        });
        txBuilder.addInstruction(newInstructions);
        return pubKey;
      }),
    );

    const ledgerAddress = await getAssociatedLedgerAccount({
      programId: new PublicKey(farmInfo.programId),
      poolId: new PublicKey(farmInfo.id),
      owner: this.scope.ownerPubKey,
    });

    if (!farmInfo.ledger && farmInfo.version < 6 /* start from v6, no need init ledger any more */) {
      const instruction = await createAssociatedLedgerAccountInstruction({
        id: farmInfo.id,
        programId: farmInfo.programId,
        version: farmInfo.version,
        ledger: ledgerAddress,
        owner: this.scope.ownerPubKey,
      });
      txBuilder.addInstruction({ instructions: [instruction] });
    }

    const lowVersionKeys = [
      accountMeta({ pubkey: farmInfo.id }),
      accountMeta({ pubkey: farmInfo.authority, isWritable: false }),
      accountMeta({ pubkey: ledgerAddress }),
      accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
      accountMeta({ pubkey: lpTokenAccount }),
      accountMeta({ pubkey: farmInfo.lpVault.mint }),
      accountMeta({ pubkey: rewardTokenAccountsPublicKeys[0] }),
      accountMeta({ pubkey: farmInfo.rewardInfos[0].rewardVault }),
      accountMeta({ pubkey: SYSVAR_CLOCK_PUBKEY, isWritable: false }),
      accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
    ];

    return { txBuilder, lpTokenAccount, rewardTokenAccountsPublicKeys, ledgerAddress, lowVersionKeys };
  }

  public async deposit(params: FarmDWParam): Promise<MakeTransaction> {
    this.scope.checkOwner();
    const { farmId, amount } = params;
    const farmInfo = this.getParsedFarm(farmId)!;
    const mint = farmInfo.lpMint;
    const { version, rewardInfos } = farmInfo;
    if (!isValidFarmVersion(version)) this.logAndCreateError("invalid farm version:", version);

    const { txBuilder, ledgerAddress, lpTokenAccount, lowVersionKeys, rewardTokenAccountsPublicKeys } =
      await this._prepareFarmAccounts({ mint, farmInfo });

    const errorMsg = validateFarmRewards({
      version,
      rewardInfos,
      rewardTokenAccountsPublicKeys,
    });
    if (errorMsg) this.logAndCreateError(errorMsg);

    const data = Buffer.alloc(dwLayout.span);
    dwLayout.encode(
      {
        instruction: farmDespotVersionToInstruction[version],
        amount: parseBigNumberish(amount),
      },
      data,
    );

    const keys =
      version === 6
        ? [
            accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
            accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
            accountMeta({ pubkey: farmInfo.id }),
            accountMeta({ pubkey: farmInfo.authority, isWritable: false }),
            accountMeta({ pubkey: farmInfo.lpVault.mint }),
            accountMeta({ pubkey: ledgerAddress }),
            accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
            accountMeta({ pubkey: lpTokenAccount }),
          ]
        : [...lowVersionKeys];

    if (version !== 3) {
      for (let index = 1; index < rewardInfos.length; index++) {
        keys.push(accountMeta({ pubkey: rewardTokenAccountsPublicKeys[index] }));
        keys.push(accountMeta({ pubkey: rewardInfos[index].rewardVault }));
      }
    }

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: farmInfo.programId, keys, data })],
      })
      .build();
  }

  public async withdraw(params: FarmDWParam): Promise<MakeTransaction> {
    this.scope.checkOwner();
    const { farmId, amount } = params;
    const farmInfo = this.getParsedFarm(farmId)!;
    const mint = farmInfo.lpMint;
    const { version, rewardInfos } = farmInfo;
    if (!isValidFarmVersion(version)) this.logAndCreateError("invalid farm version:", version);
    const { txBuilder, ledgerAddress, lpTokenAccount, lowVersionKeys, rewardTokenAccountsPublicKeys } =
      await this._prepareFarmAccounts({ mint, farmInfo });

    const data = Buffer.alloc(dwLayout.span);
    dwLayout.encode(
      {
        instruction: farmWithdrawVersionToInstruction[version],
        amount: parseBigNumberish(amount),
      },
      data,
    );

    const keys =
      version === 6
        ? [
            accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
            accountMeta({ pubkey: farmInfo.id }),
            accountMeta({ pubkey: farmInfo.authority, isWritable: false }),
            accountMeta({ pubkey: farmInfo.lpVault.mint }),
            accountMeta({ pubkey: ledgerAddress }),
            accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
            accountMeta({ pubkey: lpTokenAccount }),
          ]
        : [...lowVersionKeys];

    if (version !== 3) {
      for (let index = 1; index < rewardInfos.length; index++) {
        keys.push(accountMeta({ pubkey: rewardTokenAccountsPublicKeys[index] }));
        keys.push(accountMeta({ pubkey: rewardInfos[index].rewardVault }));
      }
    }

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: farmInfo.programId, keys, data })],
      })
      .build();
  }

  // token account needed
  public async withdrawFarmReward({
    farmId,
    withdrawMint,
  }: {
    farmId: PublicKey;
    withdrawMint: PublicKey;
    payer?: PublicKey;
  }): Promise<MakeTransaction> {
    this.scope.checkOwner();
    const farmInfo = this.getParsedFarm(farmId);
    const { version } = farmInfo;
    if (version !== 6) this.logAndCreateError("invalid farm version", farmInfo!.version);

    const rewardInfo = farmInfo.rewardInfos.find((item) =>
      item.rewardMint.equals(withdrawMint.equals(SOLMint) ? new PublicKey(TOKEN_WSOL.mint) : withdrawMint),
    );
    if (!rewardInfo) this.logAndCreateError("withdraw mint error", "rewardInfos", farmInfo);

    const rewardVault = rewardInfo?.rewardVault ?? SOLMint;
    const txBuilder = this.createTxBuilder();

    let userRewardToken: PublicKey;
    this._getUserRewardInfo({
      payer: this.scope.ownerPubKey,
      rewardInfo: rewardInfo!,
    });

    if (withdrawMint.equals(SOLMint)) {
      const txInstruction = await createWrappedNativeAccountInstructions({
        connection: this.scope.connection,
        owner: this.scope.ownerPubKey,
        payer: this.scope.ownerPubKey,
        amount: calFarmRewardAmount(rewardInfo!),
      });
      userRewardToken = txInstruction.signers![0].publicKey;
      txBuilder.addInstruction(txInstruction);
    } else {
      const selectUserRewardToken = await this.scope.account.getCreatedTokenAccount({
        mint: withdrawMint,
      });

      if (selectUserRewardToken === null) {
        userRewardToken = await this.scope.account.getAssociatedTokenAccount(withdrawMint);
        txBuilder.addInstruction({
          instructions: [
            Token.createAssociatedTokenAccountInstruction(
              ASSOCIATED_TOKEN_PROGRAM_ID,
              TOKEN_PROGRAM_ID,
              withdrawMint,
              userRewardToken,
              this.scope.ownerPubKey,
              this.scope.ownerPubKey,
            ),
          ],
        });
      } else {
        userRewardToken = selectUserRewardToken!;
      }
    }

    const data = Buffer.alloc(withdrawRewardLayout.span);
    withdrawRewardLayout.encode({ instruction: 5 }, data);

    const keys = [
      accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
      accountMeta({ pubkey: farmInfo.id }),
      accountMeta({ pubkey: farmInfo.authority, isWritable: false }),
      accountMeta({ pubkey: farmInfo.lpVault.mint, isWritable: false }),
      accountMeta({ pubkey: rewardVault }),
      accountMeta({ pubkey: userRewardToken }),
      accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
    ];

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: farmInfo.programId, keys, data })],
      })
      .build();
  }
}
