import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID, METADATA_PROGRAM_ID, RENT_PROGRAM_ID, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID,
} from "../common";
import { parseBigNumberish } from "../entity";
import { bool, s32, struct, u128, u64, u8 } from "../marshmallow";

const anchorDataBuf = {
  createPool: [233, 146, 209, 142, 207, 104, 64, 188],
  initReward: [95, 135, 192, 196, 242, 129, 230, 68],
  setRewardEmissions: [112, 52, 167, 75, 32, 201, 211, 137],
  openPosition: [135, 128, 47, 77, 15, 152, 240, 49],
  closePosition: [123, 134, 81, 0, 49, 68, 98, 98],
  increaseLiquidity: [46, 156, 243, 118, 13, 205, 251, 178],
  decreaseLiquidity: [160, 38, 208, 111, 104, 91, 44, 1],
  swap: [248, 198, 158, 145, 225, 117, 135, 200],
  collectReward: [18, 237, 166, 197, 34, 16, 213, 144],
};

export function createPoolInstruction(
  programId: PublicKey,
  poolId: PublicKey,
  poolCreator: PublicKey,
  ammConfigId: PublicKey,
  observationId: PublicKey,
  mintA: PublicKey,
  mintVaultA: PublicKey,
  mintB: PublicKey,
  mintVaultB: PublicKey,
  sqrtPriceX64: BN
) {
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
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: RENT_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      sqrtPriceX64,
    },
    data
  );
  const aData = Buffer.from([...anchorDataBuf.createPool, ...data]);

  return new TransactionInstruction({
    keys,
    programId,
    data: aData,
  });
}

export function openPositionInstruction(
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
  amountMinB: BN
) {
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
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
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
    data
  );

  const aData = Buffer.from([...anchorDataBuf.openPosition, ...data]);

  return new TransactionInstruction({
    keys,
    programId,
    data: aData,
  });
}

export function closePositionInstruction(
  programId: PublicKey,
  positionNftOwner: PublicKey,
  positionNftMint: PublicKey,
  positionNftAccount: PublicKey,
  personalPosition: PublicKey
) {
  const dataLayout = struct([]);

  const keys = [
    { pubkey: positionNftOwner, isSigner: true, isWritable: true },
    { pubkey: positionNftMint, isSigner: false, isWritable: true },
    { pubkey: positionNftAccount, isSigner: false, isWritable: true },
    { pubkey: personalPosition, isSigner: false, isWritable: true },

    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
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

export function increaseLiquidityInstruction(
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
  amountMaxA: BN,
  amountMaxB: BN
) {
  const dataLayout = struct([
    u128("liquidity"),
    u64("amountMaxA"),
    u64("amountMaxB"),
  ]);

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
      amountMaxA,
      amountMaxB,
    },
    data
  );

  const aData = Buffer.from([...anchorDataBuf.increaseLiquidity, ...data]);

  return new TransactionInstruction({
    keys,
    programId,
    data: aData,
  });
}

export function decreaseLiquidityInstruction(
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
    poolRewardVault: PublicKey,
    ownerRewardVault: PublicKey
  }[],

  liquidity: BN,
  amountMinA: BN,
  amountMinB: BN
) {
  const dataLayout = struct([
    u128("liquidity"),
    u64("amountMinA"),
    u64("amountMinB"),
  ]);

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

    ...rewardAccounts.map(i => ([
      { pubkey: i.poolRewardVault, isSigner: false, isWritable: true },
      { pubkey: i.ownerRewardVault, isSigner: false, isWritable: true }
    ])).flat()
  ];

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      liquidity,
      amountMinA,
      amountMinB,
    },
    data
  );

  const aData = Buffer.from([...anchorDataBuf.decreaseLiquidity, ...data]);

  return new TransactionInstruction({
    keys,
    programId,
    data: aData,
  });
}

export function swapInstruction(
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
  isBaseInput: boolean
) {
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

    ...tickArray
      .map((i) => ({ pubkey: i, isSigner: false, isWritable: true })),
  ];

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      amount,
      otherAmountThreshold,
      sqrtPriceLimitX64,
      isBaseInput,
    },
    data
  );

  const aData = Buffer.from([...anchorDataBuf.swap, ...data]);

  return new TransactionInstruction({
    keys,
    programId,
    data: aData,
  });
}

export function initRewardInstruction(
  programId: PublicKey,
  payer: PublicKey,
  poolId: PublicKey,
  operationId: PublicKey,
  ammConfigId: PublicKey,

  ownerTokenAccount: PublicKey,
  rewardMint: PublicKey,
  rewardVault: PublicKey,

  openTime: number,
  endTime: number,
  emissionsPerSecondX64: BN
) {
  const dataLayout = struct([
    u64("openTime"),
    u64("endTime"),
    u128("emissionsPerSecondX64"),
  ]);

  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: ownerTokenAccount, isSigner: false, isWritable: true },
    { pubkey: ammConfigId, isSigner: false, isWritable: false },

    { pubkey: poolId, isSigner: false, isWritable: true },
    { pubkey: operationId, isSigner: false, isWritable: true },
    { pubkey: rewardMint, isSigner: false, isWritable: false },
    { pubkey: rewardVault, isSigner: false, isWritable: true },

    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: RENT_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      openTime: parseBigNumberish(openTime),
      endTime: parseBigNumberish(endTime),
      emissionsPerSecondX64,
    },
    data
  );

  const aData = Buffer.from([...anchorDataBuf.initReward, ...data]);

  return new TransactionInstruction({
    keys,
    programId,
    data: aData,
  });
}

export function setRewardInstruction(
  programId: PublicKey,
  payer: PublicKey,
  poolId: PublicKey,
  operationId: PublicKey,
  ammConfigId: PublicKey,

  ownerTokenAccount: PublicKey,
  rewardVault: PublicKey,

  rewardIndex: number,
  openTime: number,
  endTime: number,
  emissionsPerSecondX64: BN
) {
  const dataLayout = struct([
    u8("rewardIndex"),
    u128("emissionsPerSecondX64"),
    u64("openTime"),
    u64("endTime"),
  ]);

  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: ammConfigId, isSigner: false, isWritable: false },
    { pubkey: poolId, isSigner: false, isWritable: true },
    { pubkey: operationId, isSigner: false, isWritable: true },

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
    data
  );

  const aData = Buffer.from([...anchorDataBuf.setRewardEmissions, ...data]);

  return new TransactionInstruction({
    keys,
    programId,
    data: aData,
  });
}

export function collectRewardInstruction(
  programId: PublicKey,
  payer: PublicKey,
  poolId: PublicKey,

  ownerTokenAccount: PublicKey,
  rewardVault: PublicKey,

  rewardIndex: number,
) {
  const dataLayout = struct([
    u8("rewardIndex"),
  ]);

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
    data
  );

  const aData = Buffer.from([...anchorDataBuf.collectReward, ...data]);

  return new TransactionInstruction({
    keys,
    programId,
    data: aData,
  });
}
