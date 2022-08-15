import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AccountMeta, Keypair, PublicKey, SystemProgram, SYSVAR_CLOCK_PUBKEY, TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";

import { accountMeta, AddInstructionParam, commonSystemAccountMeta, parseBigNumberish, TxBuilder } from "../../common";
import { TOKEN_WSOL } from "../../token";
import { closeAccountInstruction, createWrappedNativeAccountInstructions } from "../account/util";
import Module, { ModuleProps } from "../module";
import { MakeTransaction } from "../type";

import {
  FARM_LOCK_MINT, FARM_LOCK_VAULT, farmDespotVersionToInstruction, farmWithdrawVersionToInstruction, isValidFarmVersion,
  validateFarmRewards,
} from "./config";
import {
  dwLayout, farmAddRewardLayout, farmRewardLayout, farmRewardRestartLayout, farmStateV6Layout, withdrawRewardLayout,
} from "./layout";
import {
  FarmDWParam, FarmPoolJsonInfo, FarmRewardInfo, FarmRewardInfoConfig, RewardInfoKey, RewardSetParam, SdkParsedFarmInfo,
} from "./type";
import {
  calRewardAmount, createAssociatedLedgerAccountInstruction, farmInfoStringToPubKey, getAssociatedAuthority,
  getAssociatedLedgerAccount, getAssociatedLedgerPoolAccount, getFarmProgramId, mergeSdkFarmInfo, rewardInfoToConfig,
} from "./util";

export default class Farm extends Module {
  private _farmPools: FarmPoolJsonInfo[] = [];
  private _sdkParsedFarmPools: SdkParsedFarmInfo[] = [];
  constructor(params: ModuleProps) {
    super(params);
  }

  public async load(): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchLiquidity();
    await this.scope.fetchFarms();

    this._farmPools = Object.keys(this.scope.apiData.farmPools || {}).reduce(
      (acc, cur) => acc.concat(this.scope.apiData.farmPools![cur].map((data) => ({ ...data, category: cur }))),
      [],
    );

    this._sdkParsedFarmPools = await mergeSdkFarmInfo(
      {
        connection: this.scope.connection,
        pools: this._farmPools.map(farmInfoStringToPubKey),
        owner: this.scope.owner.publicKey,
        config: { commitment: "confirmed" },
      },
      { jsonInfos: this._farmPools },
    );
  }

  public getAll(): FarmPoolJsonInfo[] {
    return this._farmPools;
  }
  public getParsedAll(): SdkParsedFarmInfo[] {
    return this._sdkParsedFarmPools;
  }

  public getFarm(farmId: string): FarmPoolJsonInfo {
    const farmInfo = this.getAll().find((farm) => farm.id === farmId);
    if (!farmInfo) this.logAndCreateError("invalid farm id");
    return farmInfo!;
  }
  public getParsedFarm(farmId: string): SdkParsedFarmInfo {
    const farmInfo = this.getParsedAll().find((farm) => new PublicKey(farmId).equals(farm.id));
    if (!farmInfo) this.logAndCreateError("invalid farm id");
    return farmInfo!;
  }

  private async _getUserRewardInfo({ payer, rewardInfo }: { payer: PublicKey; rewardInfo: FarmRewardInfo }): Promise<{
    rewardPubKey?: PublicKey;
    newInstruction?: AddInstructionParam;
  }> {
    if (rewardInfo.rewardMint.equals(PublicKey.default)) {
      const { instructions, signer } = await createWrappedNativeAccountInstructions({
        connection: this.scope.connection,
        owner: this.scope.owner.publicKey,
        payer,
        amount: calRewardAmount(rewardInfo),
      });
      return {
        rewardPubKey: signer.publicKey,
        newInstruction: {
          instructions,
          signers: [signer],
          endInstructions: [
            closeAccountInstruction({
              tokenAccount: signer.publicKey,
              payer,
              owner: this.scope.owner.publicKey,
            }),
          ],
        },
      };
    }

    return {
      rewardPubKey: await this.scope.account.getCreatedTokenAccount({
        mint: rewardInfo.rewardMint,
      })!,
    };
  }

  public async create({ poolId, rewardInfos, payer }: RewardSetParam): Promise<MakeTransaction> {
    this.checkDisabled();
    this.scope.checkOwner();

    const poolJsonInfo = this.scope.liquidity.getAllPools().find((j) => j.id === poolId);
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
    const payerPubKey = payer ?? this.scope.owner.publicKey;
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
      rewardInfoConfig.push(rewardInfoToConfig(rewardInfo));

      const { rewardPubKey, newInstruction } = await this._getUserRewardInfo({
        rewardInfo,
        payer: payerPubKey,
      });
      if (newInstruction) txBuilder.addInstruction(newInstruction);

      if (!rewardPubKey) this.logAndCreateError("cannot found target token accounts", this.scope.account.tokenAccounts);

      const rewardMint = rewardInfo.rewardMint.equals(PublicKey.default)
        ? new PublicKey(TOKEN_WSOL.mint)
        : rewardInfo.rewardMint;
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
      accountMeta({ pubkey: lockUserAccount ?? PublicKey.default }),
      accountMeta({ pubkey: this.scope.owner.publicKey, isWritable: false }),
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

  public async restartReward({
    farmId,
    payer,
    newRewardInfo,
  }: {
    farmId: string;
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

    const payerPubKey = payer || this.scope.owner.publicKey;

    const rewardMint = newRewardInfo.rewardMint.equals(PublicKey.default)
      ? new PublicKey(TOKEN_WSOL.mint)
      : newRewardInfo.rewardMint;
    const rewardInfo = poolKeys.rewardInfos.find((item) => new PublicKey(item.rewardMint).equals(rewardMint));

    if (!rewardInfo) this.logAndCreateError("configuration does not exist", "rewardMint", rewardMint);

    const rewardVault = rewardInfo!.rewardVault ? new PublicKey(rewardInfo!.rewardVault) : PublicKey.default;
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
      accountMeta({ pubkey: this.scope.owner.publicKey, isWritable: false }),
    ];

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: poolKeys.programId, keys, data })],
      })
      .build();
  }

  public async addNewRewardToken(params: {
    farmId: string;
    payer?: PublicKey;
    newRewardInfo: FarmRewardInfo;
  }): Promise<MakeTransaction> {
    const { farmId, newRewardInfo, payer } = params;
    const farmInfo = this.getFarm(farmId)!;
    if (farmInfo!.version !== 6) this.logAndCreateError("invalid farm version", farmInfo!.version);
    const payerPubKey = payer ?? this.scope.owner.publicKey;
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

    const rewardMint = newRewardInfo.rewardMint.equals(PublicKey.default)
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
      accountMeta({ pubkey: this.scope.owner.publicKey, isWritable: false }),
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
      owner: this.scope.owner.publicKey,
    });

    if (!farmInfo.ledger && farmInfo.version < 6 /* start from v6, no need init ledger any more */) {
      const instruction = await createAssociatedLedgerAccountInstruction({
        id: farmInfo.id,
        programId: farmInfo.programId,
        version: farmInfo.version,
        ledger: ledgerAddress,
        owner: this.scope.owner.publicKey,
      });
      txBuilder.addInstruction({ instructions: [instruction] });
    }

    const lowVersionKeys = [
      accountMeta({ pubkey: farmInfo.id }),
      accountMeta({ pubkey: farmInfo.authority, isWritable: false }),
      accountMeta({ pubkey: ledgerAddress }),
      accountMeta({ pubkey: this.scope.owner.publicKey, isWritable: false }),
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
            accountMeta({ pubkey: this.scope.owner.publicKey, isWritable: false }),
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
            accountMeta({ pubkey: this.scope.owner.publicKey, isWritable: false }),
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

  public async withdrawFarmReward({
    farmId,
    withdrawMint,
  }: {
    farmId: string;
    withdrawMint: PublicKey;
    payer?: PublicKey;
  }): Promise<MakeTransaction> {
    this.scope.checkOwner();
    const farmInfo = this.getParsedFarm(farmId);
    const { version } = farmInfo;
    if (version !== 6) this.logAndCreateError("invalid farm version", farmInfo!.version);

    const rewardInfo = farmInfo.rewardInfos.find((item) =>
      item.rewardMint.equals(withdrawMint.equals(PublicKey.default) ? new PublicKey(TOKEN_WSOL.mint) : withdrawMint),
    );
    if (!rewardInfo) this.logAndCreateError("withdraw mint error", "rewardInfos", farmInfo);

    const rewardVault = rewardInfo?.rewardVault ?? PublicKey.default;
    const txBuilder = this.createTxBuilder();

    let userRewardToken: PublicKey;
    this._getUserRewardInfo({
      payer: this.scope.owner.publicKey,
      rewardInfo: rewardInfo!,
    });

    if (withdrawMint.equals(PublicKey.default)) {
      const { instructions, signer } = await createWrappedNativeAccountInstructions({
        connection: this.scope.connection,
        owner: this.scope.owner.publicKey,
        payer: this.scope.owner.publicKey,
        amount: calRewardAmount(rewardInfo!),
      });
      userRewardToken = signer.publicKey;
      txBuilder.addInstruction({ instructions, signers: [signer] });
      txBuilder.addInstruction({
        endInstructions: [
          closeAccountInstruction({
            tokenAccount: signer.publicKey,
            payer: this.scope.owner.publicKey,
            owner: this.scope.owner.publicKey,
          }),
        ],
      });
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
              this.scope.owner.publicKey,
              this.scope.owner.publicKey,
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
      accountMeta({ pubkey: this.scope.owner.publicKey, isSigner: false }),
    ];

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: farmInfo.programId, keys, data })],
      })
      .build();
  }
}
