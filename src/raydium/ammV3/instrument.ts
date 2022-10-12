import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, TransactionInstruction, SystemProgram, Connection, Keypair, Signer } from "@solana/web3.js";
import BN from "bn.js";
import { parseBigNumberish, RENT_PROGRAM_ID, METADATA_PROGRAM_ID } from "../../common";
import { bool, s32, struct, u128, u64, u8 } from "../../marshmallow";
import { MintInfo, ReturnTypeMakeInstructions, AmmV3PoolInfo, AmmV3PoolPersonalPosition } from "./type";
import { ObservationInfoLayout } from "./layout";
import {
  getPdaPoolId,
  getPdaPoolVaultId,
  getPdaTickArrayAddress,
  getATAAddress,
  getPdaMetadataKey,
  getPdaProtocolPositionAddress,
  getPdaPersonalPositionAddress,
} from "./utils/pda";
import { TickUtils } from "./utils/tick";

const anchorDataBuf = {
  createPool: [233, 146, 209, 142, 207, 104, 64, 188],
  initReward: [95, 135, 192, 196, 242, 129, 230, 68],
  setRewardEmissions: [13, 197, 86, 168, 109, 176, 27, 244],
  collectProtocolFee: [136, 136, 252, 221, 194, 66, 126, 89],
  openPosition: [135, 128, 47, 77, 15, 152, 240, 49],
  closePosition: [123, 134, 81, 0, 49, 68, 98, 98],
  increaseLiquidity: [46, 156, 243, 118, 13, 205, 251, 178],
  decreaseLiquidity: [160, 38, 208, 111, 104, 91, 44, 1],
  swap: [248, 198, 158, 145, 225, 117, 135, 200],
  collectReward: [18, 237, 166, 197, 34, 16, 213, 144],
};

interface CreatePoolInstruction {
  connection: Connection;
  programId: PublicKey;
  owner: PublicKey;
  mintA: MintInfo;
  mintB: MintInfo;
  ammConfigId: PublicKey;
  initialPriceX64: BN;
}

export class AmmV3Instrument {
  static createPoolInstruction(
    programId: PublicKey,
    poolId: PublicKey,
    poolCreator: PublicKey,
    ammConfigId: PublicKey,
    observationId: PublicKey,
    mintA: PublicKey,
    mintVaultA: PublicKey,
    mintB: PublicKey,
    mintVaultB: PublicKey,
    sqrtPriceX64: BN,
  ): TransactionInstruction {
    const dataLayout = struct([u128("sqrtPriceX64")]);

    const keys = [
      { pubkey: poolCreator, isSigner: true, isWritable: true },
      { pubkey: ammConfigId, isSigner: false, isWritable: false },
      { pubkey: poolId, isSigner: false, isWritable: true },
      { pubkey: mintA, isSigner: false, isWritable: false },
      { pubkey: mintB, isSigner: false, isWritable: false },
      { pubkey: mintVaultA, isSigner: false, isWritable: true },
      { pubkey: mintVaultB, isSigner: false, isWritable: true },
      { pubkey: observationId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: RENT_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        sqrtPriceX64,
      },
      data,
    );
    const aData = Buffer.from([...anchorDataBuf.createPool, ...data]);

    return new TransactionInstruction({
      keys,
      programId,
      data: aData,
    });
  }

  static async createPoolInstructions(props: CreatePoolInstruction): Promise<ReturnTypeMakeInstructions> {
    const { connection, programId, owner, mintA, mintB, ammConfigId, initialPriceX64 } = props;
    const observationId = new Keypair();
    const ins = [
      SystemProgram.createAccount({
        fromPubkey: owner,
        newAccountPubkey: observationId.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(ObservationInfoLayout.span),
        space: ObservationInfoLayout.span,
        programId,
      }),
    ];

    const { publicKey: poolId } = await getPdaPoolId(programId, ammConfigId, mintA.mint, mintB.mint);
    const { publicKey: mintAVault } = await getPdaPoolVaultId(programId, poolId, mintA.mint);
    const { publicKey: mintBVault } = await getPdaPoolVaultId(programId, poolId, mintB.mint);

    ins.push(
      this.createPoolInstruction(
        programId,
        poolId,
        owner,
        ammConfigId,
        observationId.publicKey,
        mintA.mint,
        mintAVault,
        mintB.mint,
        mintBVault,
        initialPriceX64,
      ),
    );

    return {
      signers: [observationId],
      instructions: ins,
      address: { poolId, observationId: observationId.publicKey, mintAVault, mintBVault },
    };
  }

  static openPositionInstruction(
    programId: PublicKey,
    payer: PublicKey,
    poolId: PublicKey,
    positionNftOwner: PublicKey,
    positionNftMint: PublicKey,
    positionNftAccount: PublicKey,
    metadataAccount: PublicKey,
    protocolPosition: PublicKey,
    tickArrayLower: PublicKey,
    tickArrayUpper: PublicKey,
    personalPosition: PublicKey,
    ownerTokenAccountA: PublicKey,
    ownerTokenAccountB: PublicKey,
    tokenVaultA: PublicKey,
    tokenVaultB: PublicKey,

    tickLowerIndex: number,
    tickUpperIndex: number,
    tickArrayLowerStartIndex: number,
    tickArrayUpperStartIndex: number,
    liquidity: BN,
    amountMinA: BN,
    amountMinB: BN,
  ): TransactionInstruction {
    const dataLayout = struct([
      s32("tickLowerIndex"),
      s32("tickUpperIndex"),
      s32("tickArrayLowerStartIndex"),
      s32("tickArrayUpperStartIndex"),
      u128("liquidity"),
      u64("amountMinA"),
      u64("amountMinB"),
    ]);

    const keys = [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: positionNftOwner, isSigner: false, isWritable: false },
      { pubkey: positionNftMint, isSigner: true, isWritable: true },
      { pubkey: positionNftAccount, isSigner: false, isWritable: true },
      { pubkey: metadataAccount, isSigner: false, isWritable: true },
      { pubkey: poolId, isSigner: false, isWritable: true },
      { pubkey: protocolPosition, isSigner: false, isWritable: true },
      { pubkey: tickArrayLower, isSigner: false, isWritable: true },
      { pubkey: tickArrayUpper, isSigner: false, isWritable: true },
      { pubkey: personalPosition, isSigner: false, isWritable: true },
      { pubkey: ownerTokenAccountA, isSigner: false, isWritable: true },
      { pubkey: ownerTokenAccountB, isSigner: false, isWritable: true },
      { pubkey: tokenVaultA, isSigner: false, isWritable: true },
      { pubkey: tokenVaultB, isSigner: false, isWritable: true },

      { pubkey: RENT_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        tickLowerIndex,
        tickUpperIndex,
        tickArrayLowerStartIndex,
        tickArrayUpperStartIndex,
        liquidity,
        amountMinA,
        amountMinB,
      },
      data,
    );

    const aData = Buffer.from([...anchorDataBuf.openPosition, ...data]);

    return new TransactionInstruction({
      keys,
      programId,
      data: aData,
    });
  }

  static async openPositionInstructions({
    poolInfo,
    ownerInfo,
    tickLower,
    tickUpper,
    liquidity,
    amountSlippageA,
    amountSlippageB,
  }: {
    poolInfo: AmmV3PoolInfo;

    ownerInfo: {
      feePayer: PublicKey;
      wallet: PublicKey;
      tokenAccountA: PublicKey;
      tokenAccountB: PublicKey;
    };

    tickLower: number;
    tickUpper: number;
    liquidity: BN;
    amountSlippageA: BN;
    amountSlippageB: BN;
  }): Promise<ReturnTypeMakeInstructions> {
    const signers: Signer[] = [];

    const nftMintAKeypair = new Keypair();
    signers.push(nftMintAKeypair);

    const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(tickLower, poolInfo.ammConfig.tickSpacing);
    const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(tickUpper, poolInfo.ammConfig.tickSpacing);

    const { publicKey: tickArrayLower } = await getPdaTickArrayAddress(
      poolInfo.programId,
      poolInfo.id,
      tickArrayLowerStartIndex,
    );
    const { publicKey: tickArrayUpper } = await getPdaTickArrayAddress(
      poolInfo.programId,
      poolInfo.id,
      tickArrayUpperStartIndex,
    );

    const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, nftMintAKeypair.publicKey);
    const { publicKey: metadataAccount } = await getPdaMetadataKey(nftMintAKeypair.publicKey);
    const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(
      poolInfo.programId,
      nftMintAKeypair.publicKey,
    );
    const { publicKey: protocolPosition } = await getPdaProtocolPositionAddress(
      poolInfo.programId,
      poolInfo.id,
      tickLower,
      tickUpper,
    );

    const ins = this.openPositionInstruction(
      poolInfo.programId,
      ownerInfo.feePayer,
      poolInfo.id,
      ownerInfo.wallet,
      nftMintAKeypair.publicKey,
      positionNftAccount,
      metadataAccount,
      protocolPosition,
      tickArrayLower,
      tickArrayUpper,
      personalPosition,
      ownerInfo.tokenAccountA,
      ownerInfo.tokenAccountB,
      poolInfo.mintA.vault,
      poolInfo.mintB.vault,

      tickLower,
      tickUpper,
      tickArrayLowerStartIndex,
      tickArrayUpperStartIndex,
      liquidity,
      amountSlippageA,
      amountSlippageB,
    );

    return {
      signers: [nftMintAKeypair],
      instructions: [ins],
      address: {},
    };
  }

  static closePositionInstruction(
    programId: PublicKey,
    positionNftOwner: PublicKey,
    positionNftMint: PublicKey,
    positionNftAccount: PublicKey,
    personalPosition: PublicKey,
  ): TransactionInstruction {
    const dataLayout = struct([]);

    const keys = [
      { pubkey: positionNftOwner, isSigner: true, isWritable: true },
      { pubkey: positionNftMint, isSigner: false, isWritable: true },
      { pubkey: positionNftAccount, isSigner: false, isWritable: true },
      { pubkey: personalPosition, isSigner: false, isWritable: false },

      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode({}, data);

    const aData = Buffer.from([...anchorDataBuf.closePosition, ...data]);

    return new TransactionInstruction({
      keys,
      programId,
      data: aData,
    });
  }

  static async makeClosePositionInstructions({
    poolInfo,
    ownerInfo,
    ownerPosition,
  }: {
    poolInfo: AmmV3PoolInfo;
    ownerPosition: AmmV3PoolPersonalPosition;
    ownerInfo: {
      wallet: PublicKey;
    };
  }): Promise<ReturnTypeMakeInstructions> {
    const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, ownerPosition.nftMint);
    const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(
      poolInfo.programId,
      ownerPosition.nftMint,
    );

    const ins: TransactionInstruction[] = [];
    ins.push(
      this.closePositionInstruction(
        poolInfo.programId,

        ownerInfo.wallet,
        ownerPosition.nftMint,
        positionNftAccount,
        personalPosition,
      ),
    );

    return {
      signers: [],
      instructions: ins,
      address: {},
    };
  }

  static increaseLiquidityInstruction(
    programId: PublicKey,
    positionNftOwner: PublicKey,
    positionNftAccount: PublicKey,
    personalPosition: PublicKey,

    poolId: PublicKey,
    protocolPosition: PublicKey,
    tickArrayLower: PublicKey,
    tickArrayUpper: PublicKey,
    ownerTokenAccountA: PublicKey,
    ownerTokenAccountB: PublicKey,
    mintVaultA: PublicKey,
    mintVaultB: PublicKey,

    liquidity: BN,
    amount0Max: BN,
    amount1Max: BN,
  ): TransactionInstruction {
    const dataLayout = struct([u128("liquidity"), u64("amount0Max"), u64("amount1Max")]);

    const keys = [
      { pubkey: positionNftOwner, isSigner: true, isWritable: false },
      { pubkey: positionNftAccount, isSigner: false, isWritable: false },
      { pubkey: poolId, isSigner: false, isWritable: true },
      { pubkey: protocolPosition, isSigner: false, isWritable: true },
      { pubkey: personalPosition, isSigner: false, isWritable: true },
      { pubkey: tickArrayLower, isSigner: false, isWritable: true },
      { pubkey: tickArrayUpper, isSigner: false, isWritable: true },
      { pubkey: ownerTokenAccountA, isSigner: false, isWritable: true },
      { pubkey: ownerTokenAccountB, isSigner: false, isWritable: true },
      { pubkey: mintVaultA, isSigner: false, isWritable: true },
      { pubkey: mintVaultB, isSigner: false, isWritable: true },

      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        liquidity,
        amount0Max,
        amount1Max,
      },
      data,
    );

    const aData = Buffer.from([...anchorDataBuf.increaseLiquidity, ...data]);

    return new TransactionInstruction({
      keys,
      programId,
      data: aData,
    });
  }

  static async makeIncreaseLiquidityInstructions({
    poolInfo,
    ownerPosition,
    ownerInfo,
    liquidity,
    amountSlippageA,
    amountSlippageB,
  }: {
    poolInfo: AmmV3PoolInfo;
    ownerPosition: AmmV3PoolPersonalPosition;

    ownerInfo: {
      wallet: PublicKey;
      tokenAccountA: PublicKey;
      tokenAccountB: PublicKey;
    };

    liquidity: BN;
    amountSlippageA: BN;
    amountSlippageB: BN;
  }): Promise<ReturnTypeMakeInstructions> {
    const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
      ownerPosition.tickLower,
      poolInfo.ammConfig.tickSpacing,
    );
    const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
      ownerPosition.tickUpper,
      poolInfo.ammConfig.tickSpacing,
    );

    const { publicKey: tickArrayLower } = await getPdaTickArrayAddress(
      poolInfo.programId,
      poolInfo.id,
      tickArrayLowerStartIndex,
    );
    const { publicKey: tickArrayUpper } = await getPdaTickArrayAddress(
      poolInfo.programId,
      poolInfo.id,
      tickArrayUpperStartIndex,
    );

    const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, ownerPosition.nftMint);

    const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(
      poolInfo.programId,
      ownerPosition.nftMint,
    );
    const { publicKey: protocolPosition } = await getPdaProtocolPositionAddress(
      poolInfo.programId,
      poolInfo.id,
      ownerPosition.tickLower,
      ownerPosition.tickUpper,
    );

    const ins: TransactionInstruction[] = [];
    ins.push(
      this.increaseLiquidityInstruction(
        poolInfo.programId,
        ownerInfo.wallet,
        positionNftAccount,
        personalPosition,
        poolInfo.id,
        protocolPosition,
        tickArrayLower,
        tickArrayUpper,
        ownerInfo.tokenAccountA,
        ownerInfo.tokenAccountB,
        poolInfo.mintA.vault,
        poolInfo.mintB.vault,

        liquidity,
        amountSlippageA,
        amountSlippageB,
      ),
    );

    return {
      signers: [],
      instructions: ins,
      address: {},
    };
  }

  static decreaseLiquidityInstruction(
    programId: PublicKey,
    positionNftOwner: PublicKey,
    positionNftAccount: PublicKey,
    personalPosition: PublicKey,

    poolId: PublicKey,
    protocolPosition: PublicKey,
    tickArrayLower: PublicKey,
    tickArrayUpper: PublicKey,
    ownerTokenAccountA: PublicKey,
    ownerTokenAccountB: PublicKey,
    mintVaultA: PublicKey,
    mintVaultB: PublicKey,
    rewardAccounts: {
      poolRewardVault: PublicKey;
      ownerRewardVault: PublicKey;
    }[],

    liquidity: BN,
    amount0Max: BN,
    amount1Max: BN,
  ): TransactionInstruction {
    const dataLayout = struct([u128("liquidity"), u64("amount0Max"), u64("amount1Max")]);

    const keys = [
      { pubkey: positionNftOwner, isSigner: true, isWritable: false },
      { pubkey: positionNftAccount, isSigner: false, isWritable: false },
      { pubkey: personalPosition, isSigner: false, isWritable: true },
      { pubkey: poolId, isSigner: false, isWritable: true },
      { pubkey: protocolPosition, isSigner: false, isWritable: true },
      { pubkey: mintVaultA, isSigner: false, isWritable: true },
      { pubkey: mintVaultB, isSigner: false, isWritable: true },
      { pubkey: tickArrayLower, isSigner: false, isWritable: true },
      { pubkey: tickArrayUpper, isSigner: false, isWritable: true },

      { pubkey: ownerTokenAccountA, isSigner: false, isWritable: true },
      { pubkey: ownerTokenAccountB, isSigner: false, isWritable: true },

      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },

      ...rewardAccounts
        .map((i) => [
          { pubkey: i.poolRewardVault, isSigner: false, isWritable: true },
          { pubkey: i.ownerRewardVault, isSigner: false, isWritable: true },
        ])
        .flat(),
    ];

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        liquidity,
        amount0Max,
        amount1Max,
      },
      data,
    );

    const aData = Buffer.from([...anchorDataBuf.decreaseLiquidity, ...data]);

    return new TransactionInstruction({
      keys,
      programId,
      data: aData,
    });
  }

  static async makeDecreaseLiquidityInstructions({
    poolInfo,
    ownerPosition,
    ownerInfo,
    liquidity,
    amountSlippageA,
    amountSlippageB,
  }: {
    poolInfo: AmmV3PoolInfo;
    ownerPosition: AmmV3PoolPersonalPosition;

    ownerInfo: {
      wallet: PublicKey;
      tokenAccountA: PublicKey;
      tokenAccountB: PublicKey;
      rewardAccounts: PublicKey[];
    };

    liquidity: BN;
    amountSlippageA: BN;
    amountSlippageB: BN;
  }): Promise<ReturnTypeMakeInstructions> {
    const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
      ownerPosition.tickLower,
      poolInfo.ammConfig.tickSpacing,
    );
    const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
      ownerPosition.tickUpper,
      poolInfo.ammConfig.tickSpacing,
    );

    const { publicKey: tickArrayLower } = await getPdaTickArrayAddress(
      poolInfo.programId,
      poolInfo.id,
      tickArrayLowerStartIndex,
    );
    const { publicKey: tickArrayUpper } = await getPdaTickArrayAddress(
      poolInfo.programId,
      poolInfo.id,
      tickArrayUpperStartIndex,
    );
    const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, ownerPosition.nftMint);

    const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(
      poolInfo.programId,
      ownerPosition.nftMint,
    );
    const { publicKey: protocolPosition } = await getPdaProtocolPositionAddress(
      poolInfo.programId,
      poolInfo.id,
      ownerPosition.tickLower,
      ownerPosition.tickUpper,
    );

    const rewardAccounts: {
      poolRewardVault: PublicKey;
      ownerRewardVault: PublicKey;
    }[] = [];
    for (let i = 0; i < poolInfo.rewardInfos.length; i++) {
      rewardAccounts.push({
        poolRewardVault: poolInfo.rewardInfos[0].tokenVault,
        ownerRewardVault: ownerInfo.rewardAccounts[0],
      });
    }

    const ins: TransactionInstruction[] = [];
    ins.push(
      this.decreaseLiquidityInstruction(
        poolInfo.programId,
        ownerInfo.wallet,
        positionNftAccount,
        personalPosition,
        poolInfo.id,
        protocolPosition,
        tickArrayLower,
        tickArrayUpper,
        ownerInfo.tokenAccountA,
        ownerInfo.tokenAccountB,
        poolInfo.mintA.vault,
        poolInfo.mintB.vault,
        rewardAccounts,

        liquidity,
        amountSlippageA,
        amountSlippageB,
      ),
    );

    return {
      signers: [],
      instructions: ins,
      address: {},
    };
  }

  static swapInstruction(
    programId: PublicKey,
    payer: PublicKey,
    poolId: PublicKey,
    ammConfigId: PublicKey,
    inputTokenAccount: PublicKey,
    outputTokenAccount: PublicKey,
    inputVault: PublicKey,
    outputVault: PublicKey,
    tickArray: PublicKey[],
    observationId: PublicKey,

    amount: BN,
    otherAmountThreshold: BN,
    sqrtPriceLimitX64: BN,
    isBaseInput: boolean,
  ): TransactionInstruction {
    const dataLayout = struct([
      u64("amount"),
      u64("otherAmountThreshold"),
      u128("sqrtPriceLimitX64"),
      bool("isBaseInput"),
    ]);

    const keys = [
      { pubkey: payer, isSigner: true, isWritable: false },
      { pubkey: ammConfigId, isSigner: false, isWritable: false },

      { pubkey: poolId, isSigner: false, isWritable: true },
      { pubkey: inputTokenAccount, isSigner: false, isWritable: true },
      { pubkey: outputTokenAccount, isSigner: false, isWritable: true },
      { pubkey: inputVault, isSigner: false, isWritable: true },
      { pubkey: outputVault, isSigner: false, isWritable: true },

      { pubkey: observationId, isSigner: false, isWritable: true },

      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },

      ...tickArray.map((i) => ({ pubkey: i, isSigner: false, isWritable: true })),
    ];

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        amount,
        otherAmountThreshold,
        sqrtPriceLimitX64,
        isBaseInput,
      },
      data,
    );

    const aData = Buffer.from([...anchorDataBuf.swap, ...data]);

    return new TransactionInstruction({
      keys,
      programId,
      data: aData,
    });
  }

  static initRewardInstruction(
    programId: PublicKey,
    payer: PublicKey,
    poolId: PublicKey,
    ammConfigId: PublicKey,

    ownerTokenAccount: PublicKey,
    rewardMint: PublicKey,
    rewardVault: PublicKey,

    rewardIndex: number,
    openTime: number,
    endTime: number,
    emissionsPerSecondX64: BN,
  ): TransactionInstruction {
    const dataLayout = struct([u8("rewardIndex"), u64("openTime"), u64("endTime"), u128("emissionsPerSecondX64")]);

    const keys = [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ownerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: ammConfigId, isSigner: false, isWritable: false },

      { pubkey: poolId, isSigner: false, isWritable: true },
      { pubkey: rewardMint, isSigner: false, isWritable: false },
      { pubkey: rewardVault, isSigner: false, isWritable: true },

      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: RENT_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        rewardIndex,
        openTime: parseBigNumberish(openTime),
        endTime: parseBigNumberish(endTime),
        emissionsPerSecondX64,
      },
      data,
    );

    const aData = Buffer.from([...anchorDataBuf.initReward, ...data]);

    return new TransactionInstruction({
      keys,
      programId,
      data: aData,
    });
  }

  static setRewardInstruction(
    programId: PublicKey,
    payer: PublicKey,
    poolId: PublicKey,
    ammConfigId: PublicKey,

    ownerTokenAccount: PublicKey,
    rewardVault: PublicKey,

    rewardIndex: number,
    openTime: number,
    endTime: number,
    emissionsPerSecondX64: BN,
  ): TransactionInstruction {
    const dataLayout = struct([u8("rewardIndex"), u64("openTime"), u64("endTime"), u128("emissionsPerSecondX64")]);

    const keys = [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ammConfigId, isSigner: false, isWritable: false },
      { pubkey: poolId, isSigner: false, isWritable: true },

      { pubkey: rewardVault, isSigner: false, isWritable: true },
      { pubkey: ownerTokenAccount, isSigner: false, isWritable: true },

      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        rewardIndex,
        emissionsPerSecondX64,
        openTime: parseBigNumberish(openTime),
        endTime: parseBigNumberish(endTime),
      },
      data,
    );

    const aData = Buffer.from([...anchorDataBuf.setRewardEmissions, ...data]);

    return new TransactionInstruction({
      keys,
      programId,
      data: aData,
    });
  }

  static collectRewardInstruction(
    programId: PublicKey,
    payer: PublicKey,
    poolId: PublicKey,

    ownerTokenAccount: PublicKey,
    rewardVault: PublicKey,

    rewardIndex: number,
  ): TransactionInstruction {
    const dataLayout = struct([u8("rewardIndex")]);

    const keys = [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ownerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: poolId, isSigner: false, isWritable: true },
      { pubkey: rewardVault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        rewardIndex,
      },
      data,
    );

    const aData = Buffer.from([...anchorDataBuf.collectReward, ...data]);

    return new TransactionInstruction({
      keys,
      programId,
      data: aData,
    });
  }

  static addComputations(): TransactionInstruction {
    return new TransactionInstruction({
      programId: new PublicKey("ComputeBudget111111111111111111111111111111"),
      data: Buffer.from([0, 128, 26, 6, 0, 0, 0, 0, 0]),
      keys: [],
    });
  }
}
