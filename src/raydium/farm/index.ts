import {
  Keypair, PublicKey, sendAndConfirmTransaction, Signer, SystemProgram, Transaction, TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";

import { ApiFarmPools } from "../../api";
import { accountMeta, attachRecentBlockhash, commonSystemAccountMeta, parseBigNumberish } from "../../common";
import { TOKEN_WSOL } from "../../token";
import Module, { ModuleProps } from "../module";

import { FARM_LOCK_MINT, FARM_LOCK_VAULT } from "./constant";
import { farmRewardLayout, farmStateV6Layout } from "./layout";
import { FarmPoolInfoV6, RewardInfo } from "./type";
import { getAssociatedAuthority, getAssociatedLedgerPoolAccount, getFarmProgramId } from "./util";

export default class Farm extends Module {
  constructor(params: ModuleProps) {
    super(params);
  }

  public async load(): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchLiquidity();
    await this.scope.fetchFarms();
  }

  public getFarms(): ApiFarmPools | undefined {
    return this.scope.apiData.farmPools?.data;
  }

  public async makeCreateFarmInstruction({
    poolId,
    rewardInfos,
  }: {
    poolId: string;
    rewardInfos: RewardInfo[];
  }): Promise<{
    newAccounts: Signer[];
    instructions: TransactionInstruction[];
  }> {
    const poolJsonInfo = this.scope.liqudity.getAllPools().find((j) => j.id === poolId);
    if (!poolJsonInfo) this.logAndCreateError("invalid pool id");

    const lpMint = new PublicKey(poolJsonInfo!.lpMint);
    const poolInfo = {
      lpMint,
      lockInfo: { lockMint: FARM_LOCK_MINT, lockVault: FARM_LOCK_VAULT },
      version: 6,
      rewardInfos,
      programId: getFarmProgramId(6)!,
    };

    return await this.makeCreateFarmInstructionV6({
      poolInfo,
    });
  }

  public async makeCreateFarmInstructionV6({
    poolInfo,
    payer,
  }: {
    poolInfo: FarmPoolInfoV6;
    payer?: PublicKey;
  }): Promise<{
    newAccounts: Signer[];
    instructions: TransactionInstruction[];
  }> {
    this.checkDisabled();
    this.scope.checkowner();

    const payerPubKey = payer ?? this.scope.owner.publicKey;

    const farmId = Keypair.generate();
    const lamports = await this.scope.connection.getMinimumBalanceForRentExemption(farmStateV6Layout.span);

    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];
    const signers: Signer[] = [farmId];

    frontInstructions.push(
      SystemProgram.createAccount({
        fromPubkey: payerPubKey,
        newAccountPubkey: farmId.publicKey,
        lamports,
        space: farmStateV6Layout.span,
        programId: poolInfo.programId,
      }),
    );

    const { publicKey: authority, nonce } = await getAssociatedAuthority({
      programId: poolInfo.programId,
      poolId: farmId.publicKey,
    });

    const lpVault = await getAssociatedLedgerPoolAccount({
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
      if (rewardInfo.rewardOpenTime >= rewardInfo.rewardEndTime)
        throw this.logAndCreateError(
          "start time error",
          "rewardInfo.rewardOpenTime",
          rewardInfo.rewardOpenTime.toString(),
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
        const { instructions, signer } = await this.scope.account.makeCreateWrappedNativeAccountInstructions({
          payer: payerPubKey,
          amount: parseBigNumberish(rewardInfo.rewardEndTime)
            .sub(parseBigNumberish(rewardInfo.rewardOpenTime))
            .mul(parseBigNumberish(rewardInfo.rewardPerSecond)),
        });
        userRewardToken = signer.publicKey;
        frontInstructions.push(...instructions);
        signers.push(signer);

        endInstructions.push(
          this.scope.account.makeCloseAccountInstruction({
            tokenAccount: userRewardToken,
            payer: payerPubKey,
          }),
        );
      } else {
        userRewardToken = await this.scope.account.selectTokenAccount({
          mint: rewardInfo.rewardMint,
        });
      }

      if (userRewardToken == null) {
        throw this.logAndCreateError(
          "cannot found target token accounts",
          "tokenAccounts",
          this.scope.account.tokenAccouns,
        );
      }

      const rewardMint = rewardInfo.rewardMint.equals(PublicKey.default)
        ? new PublicKey(TOKEN_WSOL.mint)
        : rewardInfo.rewardMint;
      rewardInfoKey.push({
        rewardMint,
        rewardVault: await getAssociatedLedgerPoolAccount({
          programId: poolInfo.programId,
          poolId: farmId.publicKey,
          mint: rewardMint,
          type: "rewardVault",
        }),
        userRewardToken,
      });
    }

    const lockUserAccount = await this.scope.account.selectTokenAccount({
      mint: poolInfo.lockInfo.lockMint,
    });

    if (!lockUserAccount)
      throw this.logAndCreateError("cannot found lock vault", "tokenAccounts", this.scope.account.tokenAccouns);

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
      accountMeta({ pubkey: farmId.publicKey }),
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
          accountMeta({ pubkey: item.rewardMint }),
          accountMeta({ pubkey: item.rewardVault, isWritable: true }),
          accountMeta({ pubkey: item.userRewardToken, isWritable: true }),
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
}
