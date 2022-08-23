import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram, TransactionInstruction } from "@solana/web3.js";

import { parseBigNumberish } from "../../common/bignumber";
import { createLogger } from "../../common/logger";
import { accountMeta } from "../../common/pubKey";
import { MODEL_DATA_PUBKEY } from "../liquidity/stable";

import { ROUTE_PROGRAM_ID_V1 } from "./constant";
import { routeSwapInLayout, routeSwapOutLayout } from "./layout";
import {
  RouteSwapInFixedInInstructionParams,
  RouteSwapInstructionParams,
  RouteSwapOutFixedInInstructionParams,
} from "./type";

const logger = createLogger("Raydium_route_instruction");
export function makeRouteSwapInstruction(params: RouteSwapInstructionParams): TransactionInstruction[] {
  const { fixedSide } = params;

  if (fixedSide === "in") {
    return [makeSwapInFixedInInstruction(params), makeSwapOutFixedInInstruction(params)];
  }

  logger.logWithError("invalid params", "params", params);
  throw new Error(`invalid params, params: ${params}`);
}

export function makeSwapInFixedInInstruction({
  fromPoolKeys,
  toPoolKeys,
  userKeys,
  amountIn,
  amountOut,
}: RouteSwapInFixedInInstructionParams): TransactionInstruction {
  const data = Buffer.alloc(routeSwapInLayout.span);

  let keys;

  if (fromPoolKeys.version === 4) {
    routeSwapInLayout.encode(
      {
        instruction: 0,
        amountIn: parseBigNumberish(amountIn),
        amountOut: parseBigNumberish(amountOut),
      },
      data,
    );
    keys = [
      // system
      accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
      accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
      // amm
      accountMeta({ pubkey: fromPoolKeys.programId, isWritable: false }),
      accountMeta({ pubkey: fromPoolKeys.id }),
      accountMeta({ pubkey: toPoolKeys.id, isWritable: false }),
      accountMeta({ pubkey: fromPoolKeys.authority, isWritable: false }),
      accountMeta({ pubkey: fromPoolKeys.openOrders }),
      accountMeta({ pubkey: fromPoolKeys.baseVault }),
      accountMeta({ pubkey: fromPoolKeys.quoteVault }),
      // serum
      accountMeta({ pubkey: fromPoolKeys.marketProgramId, isWritable: false }),
      accountMeta({ pubkey: fromPoolKeys.marketId }),
      accountMeta({ pubkey: fromPoolKeys.marketBids }),
      accountMeta({ pubkey: fromPoolKeys.marketAsks }),
      accountMeta({ pubkey: fromPoolKeys.marketEventQueue }),
      accountMeta({ pubkey: fromPoolKeys.marketBaseVault }),
      accountMeta({ pubkey: fromPoolKeys.marketQuoteVault }),
      accountMeta({ pubkey: fromPoolKeys.marketAuthority, isWritable: false }),
      // user
      accountMeta({ pubkey: userKeys.inTokenAccount }),
      accountMeta({ pubkey: userKeys.middleTokenAccount }),
      accountMeta({ pubkey: userKeys.middleStatusAccount }),
      accountMeta({ pubkey: userKeys.owner, isWritable: false, isSigner: true }),
    ];
  } else {
    routeSwapInLayout.encode(
      {
        instruction: 2,
        amountIn: parseBigNumberish(amountIn),
        amountOut: parseBigNumberish(amountOut),
      },
      data,
    );
    keys = [
      // system
      accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
      accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
      // amm
      accountMeta({ pubkey: fromPoolKeys.programId, isWritable: false }),
      accountMeta({ pubkey: fromPoolKeys.id }),
      accountMeta({ pubkey: toPoolKeys.id, isWritable: false }),
      accountMeta({ pubkey: fromPoolKeys.authority, isWritable: false }),
      accountMeta({ pubkey: fromPoolKeys.openOrders }),
      accountMeta({ pubkey: fromPoolKeys.baseVault }),
      accountMeta({ pubkey: fromPoolKeys.quoteVault }),
      accountMeta({ pubkey: MODEL_DATA_PUBKEY, isWritable: false }),
      // serum
      accountMeta({ pubkey: fromPoolKeys.marketProgramId, isWritable: false }),
      accountMeta({ pubkey: fromPoolKeys.marketId }),
      accountMeta({ pubkey: fromPoolKeys.marketBids }),
      accountMeta({ pubkey: fromPoolKeys.marketAsks }),
      accountMeta({ pubkey: fromPoolKeys.marketEventQueue }),
      accountMeta({ pubkey: fromPoolKeys.id }),
      accountMeta({ pubkey: fromPoolKeys.id }),
      accountMeta({ pubkey: fromPoolKeys.id }),
      // user
      accountMeta({ pubkey: userKeys.inTokenAccount }),
      accountMeta({ pubkey: userKeys.middleTokenAccount }),
      accountMeta({ pubkey: userKeys.middleStatusAccount }),
      accountMeta({ pubkey: userKeys.owner, isWritable: false, isSigner: true }),
    ];
  }

  return new TransactionInstruction({
    programId: ROUTE_PROGRAM_ID_V1,
    keys,
    data,
  });
}

export function makeSwapOutFixedInInstruction({
  fromPoolKeys,
  toPoolKeys,
  userKeys,
}: RouteSwapOutFixedInInstructionParams): TransactionInstruction {
  const data = Buffer.alloc(routeSwapOutLayout.span);

  let keys;
  if (toPoolKeys.version === 4) {
    routeSwapOutLayout.encode(
      {
        instruction: 1,
      },
      data,
    );
    keys = [
      // system
      accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
      // amm
      accountMeta({ pubkey: toPoolKeys.programId, isWritable: false }),
      accountMeta({ pubkey: fromPoolKeys.id, isWritable: false }),
      accountMeta({ pubkey: toPoolKeys.id }),
      accountMeta({ pubkey: toPoolKeys.authority, isWritable: false }),
      accountMeta({ pubkey: toPoolKeys.openOrders }),
      accountMeta({ pubkey: toPoolKeys.baseVault }),
      accountMeta({ pubkey: toPoolKeys.quoteVault }),
      // serum
      accountMeta({ pubkey: toPoolKeys.marketProgramId, isWritable: false }),
      accountMeta({ pubkey: toPoolKeys.marketId }),
      accountMeta({ pubkey: toPoolKeys.marketBids }),
      accountMeta({ pubkey: toPoolKeys.marketAsks }),
      accountMeta({ pubkey: toPoolKeys.marketEventQueue }),
      accountMeta({ pubkey: toPoolKeys.marketBaseVault }),
      accountMeta({ pubkey: toPoolKeys.marketQuoteVault }),
      accountMeta({ pubkey: toPoolKeys.marketAuthority, isWritable: false }),
      // user
      accountMeta({ pubkey: userKeys.middleTokenAccount }),
      accountMeta({ pubkey: userKeys.outTokenAccount }),
      accountMeta({ pubkey: userKeys.middleStatusAccount }),
      accountMeta({ pubkey: userKeys.owner, isWritable: false, isSigner: true }),
    ];
  } else {
    routeSwapOutLayout.encode(
      {
        instruction: 3,
      },
      data,
    );
    keys = [
      // system
      accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
      // amm
      accountMeta({ pubkey: toPoolKeys.programId, isWritable: false }),
      accountMeta({ pubkey: fromPoolKeys.id, isWritable: false }),
      accountMeta({ pubkey: toPoolKeys.id }),
      accountMeta({ pubkey: toPoolKeys.authority, isWritable: false }),
      accountMeta({ pubkey: toPoolKeys.openOrders }),
      accountMeta({ pubkey: toPoolKeys.baseVault }),
      accountMeta({ pubkey: toPoolKeys.quoteVault }),
      accountMeta({ pubkey: MODEL_DATA_PUBKEY, isWritable: false }),
      // serum
      accountMeta({ pubkey: toPoolKeys.marketProgramId, isWritable: false }),
      accountMeta({ pubkey: toPoolKeys.marketId }),
      accountMeta({ pubkey: toPoolKeys.marketBids }),
      accountMeta({ pubkey: toPoolKeys.marketAsks }),
      accountMeta({ pubkey: toPoolKeys.marketEventQueue }),
      accountMeta({ pubkey: toPoolKeys.id }),
      accountMeta({ pubkey: toPoolKeys.id }),
      accountMeta({ pubkey: toPoolKeys.id }),
      // user
      accountMeta({ pubkey: userKeys.middleTokenAccount }),
      accountMeta({ pubkey: userKeys.outTokenAccount }),
      accountMeta({ pubkey: userKeys.middleStatusAccount }),
      accountMeta({ pubkey: userKeys.owner, isWritable: false, isSigner: true }),
    ];
  }

  return new TransactionInstruction({
    programId: ROUTE_PROGRAM_ID_V1,
    keys,
    data,
  });
}
