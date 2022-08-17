import { SystemProgram, TransactionInstruction } from "@solana/web3.js";

import { parseBigNumberish } from "../../common/bignumber";
import { accountMeta } from "../../common/pubKey";
import { struct, u8 } from "../../marshmallow";

import { modelDataPubkey } from "./constant";
import { fixedSwapInLayout, fixedSwapOutLayout } from "./layout";
import {
  LiquidityPoolKeys,
  LiquiditySwapFixedInInstructionParamsV4,
  LiquiditySwapFixedOutInstructionParamsV4,
} from "./type";

export function makeSimulatePoolInfoInstruction(poolKeys: LiquidityPoolKeys): TransactionInstruction {
  const LAYOUT = struct([u8("instruction"), u8("simulateType")]);
  const data = Buffer.alloc(LAYOUT.span);
  LAYOUT.encode(
    {
      instruction: 12,
      simulateType: 0,
    },
    data,
  );

  const keys = [
    // amm
    accountMeta({ pubkey: poolKeys.id, isWritable: false }),
    accountMeta({ pubkey: poolKeys.authority, isWritable: false }),
    accountMeta({ pubkey: poolKeys.openOrders, isWritable: false }),
    accountMeta({ pubkey: poolKeys.baseVault, isWritable: false }),
    accountMeta({ pubkey: poolKeys.quoteVault, isWritable: false }),
    accountMeta({ pubkey: poolKeys.lpMint, isWritable: false }),
    // serum
    accountMeta({ pubkey: poolKeys.marketId, isWritable: false }),
  ];

  return new TransactionInstruction({
    programId: poolKeys.programId,
    keys,
    data,
  });
}

export function makeSwapFixedInInstruction(
  { poolKeys, userKeys, amountIn, minAmountOut }: LiquiditySwapFixedInInstructionParamsV4,
  version: number,
): TransactionInstruction {
  const data = Buffer.alloc(fixedSwapInLayout.span);
  fixedSwapInLayout.encode(
    {
      instruction: 9,
      amountIn: parseBigNumberish(amountIn),
      minAmountOut: parseBigNumberish(minAmountOut),
    },
    data,
  );
  const keys = [
    // amm
    accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
    accountMeta({ pubkey: poolKeys.id }),
    accountMeta({ pubkey: poolKeys.authority, isWritable: false }),
    accountMeta({ pubkey: poolKeys.openOrders }),
  ];

  if (version === 4) keys.push(accountMeta({ pubkey: poolKeys.targetOrders }));
  keys.push(accountMeta({ pubkey: poolKeys.baseVault }), accountMeta({ pubkey: poolKeys.quoteVault }));
  if (version === 5) keys.push(accountMeta({ pubkey: modelDataPubkey }));
  keys.push(
    // serum
    accountMeta({ pubkey: poolKeys.marketProgramId, isWritable: false }),
    accountMeta({ pubkey: poolKeys.marketId }),
    accountMeta({ pubkey: poolKeys.marketBids }),
    accountMeta({ pubkey: poolKeys.marketAsks }),
    accountMeta({ pubkey: poolKeys.marketEventQueue }),
    accountMeta({ pubkey: poolKeys.marketBaseVault }),
    accountMeta({ pubkey: poolKeys.marketQuoteVault }),
    accountMeta({ pubkey: poolKeys.marketAuthority, isWritable: false }),
    // user
    accountMeta({ pubkey: userKeys.tokenAccountIn }),
    accountMeta({ pubkey: userKeys.tokenAccountOut }),
    accountMeta({ pubkey: userKeys.owner, isWritable: false }),
  );

  return new TransactionInstruction({
    programId: poolKeys.programId,
    keys,
    data,
  });
}

export function makeSwapFixedOutInstruction(
  { poolKeys, userKeys, maxAmountIn, amountOut }: LiquiditySwapFixedOutInstructionParamsV4,
  version: number,
): TransactionInstruction {
  const data = Buffer.alloc(fixedSwapOutLayout.span);
  fixedSwapOutLayout.encode(
    {
      instruction: 11,
      maxAmountIn: parseBigNumberish(maxAmountIn),
      amountOut: parseBigNumberish(amountOut),
    },
    data,
  );

  const keys = [
    accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
    // amm
    accountMeta({ pubkey: poolKeys.id }),
    accountMeta({ pubkey: poolKeys.authority, isWritable: false }),
    accountMeta({ pubkey: poolKeys.openOrders }),
    accountMeta({ pubkey: poolKeys.targetOrders }),
    accountMeta({ pubkey: poolKeys.baseVault }),
    accountMeta({ pubkey: poolKeys.quoteVault }),
  ];

  if (version === 5) keys.push(accountMeta({ pubkey: modelDataPubkey }));

  keys.push(
    // serum
    accountMeta({ pubkey: poolKeys.marketProgramId, isWritable: false }),
    accountMeta({ pubkey: poolKeys.marketId }),
    accountMeta({ pubkey: poolKeys.marketBids }),
    accountMeta({ pubkey: poolKeys.marketAsks }),
    accountMeta({ pubkey: poolKeys.marketEventQueue }),
    accountMeta({ pubkey: poolKeys.marketBaseVault }),
    accountMeta({ pubkey: poolKeys.marketQuoteVault }),
    accountMeta({ pubkey: poolKeys.marketAuthority, isWritable: false }),
    accountMeta({ pubkey: userKeys.tokenAccountIn }),
    accountMeta({ pubkey: userKeys.tokenAccountOut }),
    accountMeta({ pubkey: userKeys.owner, isWritable: false, isSigner: true }),
  );

  return new TransactionInstruction({
    programId: poolKeys.programId,
    keys,
    data,
  });
}
