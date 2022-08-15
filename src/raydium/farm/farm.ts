import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { accountMeta, commonSystemAccountMeta, parseBigNumberish, TxBuilder } from "../../common";
import { TOKEN_WSOL } from "../../token";
import { closeAccountInstruction, createWrappedNativeAccountInstructions } from "../account/util";
import Module, { ModuleProps } from "../module";
import { MakeTransaction } from "../type";

import { FARM_LOCK_MINT, FARM_LOCK_VAULT } from "./constant";
import { farmAddRewardLayout, farmRewardLayout, farmRewardRestartLayout, farmStateV6Layout } from "./layout";
import { FarmPoolJsonInfo, FarmRewardInfo, FarmRewardInfoConfig, RewardInfoKey, RewardSetParam } from "./type";
import {
  calRewardAmount, getAssociatedAuthority, getAssociatedLedgerPoolAccount, getFarmProgramId, rewardInfoToConfig,
} from "./util";

export default class Farm extends Module {
  private _farmPools: FarmPoolJsonInfo[] = [];
  constructor(params: ModuleProps) {
    super(params);
  }

  public async load(): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchLiquidity();
    await this.scope.fetchFarms();
  }

  public getAll(): FarmPoolJsonInfo[] {
    if (!this.scope.apiData.farmPools) return [];
    if (this._farmPools.length) return this._farmPools;

    this._farmPools = Object.keys(this.scope.apiData.farmPools).reduce((acc, cur) => {
      return acc.concat(this.scope.apiData.farmPools![cur].map((data) => ({ ...data, category: cur })));
    }, []);
    return this._farmPools;
  }

  public getFarm(farmId: string): FarmPoolJsonInfo {
    const farmInfo = this.getAll().find((farm) => farm.id === farmId);
    if (!farmInfo) this.logAndCreateError("invalid farm id");
    if (farmInfo!.version !== 6) this.logAndCreateError("invalid farm version", farmInfo!.version);
    return farmInfo!;
  }

  public async createFarm({ poolId, rewardInfos, payer }: RewardSetParam): Promise<MakeTransaction> {
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

      const userRewardTokenPub = await this.getUserRewardInfo({
        rewardInfo,
        payer: payerPubKey,
        txBuilder,
      });

      if (!userRewardTokenPub)
        this.logAndCreateError("cannot found target token accounts", this.scope.account.tokenAccounts);

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
        userRewardToken: userRewardTokenPub!,
      });
    }

    const lockUserAccount = await this.scope.account.selectTokenAccount({
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
        instructions: [
          new TransactionInstruction({
            programId: poolInfo.programId,
            keys,
            data,
          }),
        ],
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

    const userRewardTokenPub = await this.getUserRewardInfo({
      rewardInfo: newRewardInfo,
      payer: payerPubKey,
      txBuilder,
    });
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
        instructions: [
          new TransactionInstruction({
            programId: poolKeys.programId,
            keys,
            data,
          }),
        ],
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
    const payerPubKey = payer ?? this.scope.owner.publicKey;
    const txBuilder = this.createTxBuilder();

    const rewardVault = await getAssociatedLedgerPoolAccount({
      programId: new PublicKey(farmInfo.programId),
      poolId: new PublicKey(farmInfo.id),
      mint: newRewardInfo.rewardMint,
      type: "rewardVault",
    });

    const userRewardTokenPub = await this.getUserRewardInfo({
      rewardInfo: newRewardInfo,
      payer: payerPubKey,
      txBuilder,
    });
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
        instructions: [
          new TransactionInstruction({
            programId: new PublicKey(farmInfo.programId),
            keys,
            data,
          }),
        ],
      })
      .build();
  }

  private async getUserRewardInfo({
    payer,
    rewardInfo,
    txBuilder,
  }: {
    payer: PublicKey;
    rewardInfo: FarmRewardInfo;
    txBuilder: TxBuilder;
  }): Promise<PublicKey | undefined> {
    if (rewardInfo.rewardMint.equals(PublicKey.default)) {
      const { instructions, signer } = await createWrappedNativeAccountInstructions({
        connection: this.scope.connection,
        owner: this.scope.owner.publicKey,
        payer,
        amount: calRewardAmount(rewardInfo),
      });
      txBuilder.addInstruction({
        instructions,
        signers: [signer],
        endInstructions: [
          closeAccountInstruction({
            tokenAccount: signer.publicKey,
            payer,
            owner: this.scope.owner.publicKey,
          }),
        ],
      });
      return signer.publicKey;
    }

    return await this.scope.account.selectTokenAccount({
      mint: rewardInfo.rewardMint,
    })!;
  }
}
