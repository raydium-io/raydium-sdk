import { PublicKey, TransactionInstruction } from "@solana/web3.js";

import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, Logger, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID,
} from "../common";
import { BigNumberish, parseBigNumberish } from "../entity";
import { LiquidityPoolKeys, SwapSide } from "../liquidity";
import { struct, u64, u8 } from "../marshmallow";

import {
  ROUTE_PROGRAM_ID_V1, ROUTE_PROGRAMID_TO_VERSION, ROUTE_VERSION_TO_LIQUIDITY_VERSION, ROUTE_VERSION_TO_PROGRAMID,
} from "./id";

const logger = Logger.from("Route");

/* ================= user keys ================= */
/**
 * Full user keys that build transaction need
 */
export interface RouteUserKeys {
  inTokenAccount: PublicKey;
  outTokenAccount: PublicKey;
  middleTokenAccount: PublicKey;
  middleStatusAccount: PublicKey;
  owner: PublicKey;
}

/* ================= make instruction and transaction ================= */
export interface RouteSwapInstructionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  userKeys: RouteUserKeys;
  amountIn: BigNumberish;
  amountOut: BigNumberish;
  fixedSide: SwapSide;
}

export interface RouteSwapInFixedInInstructionParams
  extends Omit<RouteSwapInstructionParams, "userKeys" | "amountOut" | "fixedSide"> {
  userKeys: Omit<RouteUserKeys, "outTokenAccount">;
}

export interface RouteSwapOutFixedInInstructionParams
  extends Omit<RouteSwapInstructionParams, "userKeys" | "amountIn" | "fixedSide"> {
  userKeys: Omit<RouteUserKeys, "inTokenAccount">;
}

export class Route {
  /* ================= get version and program id ================= */
  static getProgramId(version: number) {
    const programId = ROUTE_VERSION_TO_PROGRAMID[version];
    logger.assertArgument(!!programId, "invalid version", "version", version);

    return programId;
  }

  static getVersion(programId: PublicKey) {
    const programIdString = programId.toBase58();

    const version = ROUTE_PROGRAMID_TO_VERSION[programIdString];
    logger.assertArgument(!!version, "invalid program id", "programId", programIdString);

    return version;
  }

  static getLiquidityVersion(version: number) {
    const liquidityVersion = ROUTE_VERSION_TO_LIQUIDITY_VERSION[version];
    logger.assertArgument(!!liquidityVersion, "invalid version", "version", version);

    return liquidityVersion;
  }

  /* ================= get key ================= */
  static async getAssociatedMiddleStatusAccount({
    programId,
    fromPoolId,
    middleMint,
    owner,
  }: {
    programId: PublicKey;
    fromPoolId: PublicKey;
    middleMint: PublicKey;
    owner: PublicKey;
  }) {
    const { publicKey } = await findProgramAddress(
      [fromPoolId.toBuffer(), middleMint.toBuffer(), owner.toBuffer()],
      programId,
    );
    return publicKey;
  }

  /* ================= make instruction and transaction ================= */
  static makeSwapInstruction(params: RouteSwapInstructionParams) {
    const { fixedSide } = params;

    if (fixedSide === "in") {
      return [this.makeSwapInFixedInInstruction(params), this.makeSwapOutFixedInInstruction(params)];
    }

    return logger.throwArgumentError("invalid params", "params", params);
  }

  static makeSwapInFixedInInstruction({
    fromPoolKeys,
    toPoolKeys,
    userKeys,
    amountIn,
  }: RouteSwapInFixedInInstructionParams) {
    const LAYOUT = struct([u8("instruction"), u64("amountIn")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 0,
        amountIn: parseBigNumberish(amountIn),
      },
      data,
    );

    const keys = [
      // system
      AccountMetaReadonly(SYSTEM_PROGRAM_ID, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
      // amm
      AccountMetaReadonly(fromPoolKeys.programId, false),
      AccountMeta(fromPoolKeys.id, false),
      AccountMetaReadonly(toPoolKeys.id, false),
      AccountMetaReadonly(fromPoolKeys.authority, false),
      AccountMeta(fromPoolKeys.openOrders, false),
      AccountMeta(fromPoolKeys.baseVault, false),
      AccountMeta(fromPoolKeys.quoteVault, false),
      // serum
      AccountMetaReadonly(fromPoolKeys.marketProgramId, false),
      AccountMeta(fromPoolKeys.marketId, false),
      AccountMeta(fromPoolKeys.marketBids, false),
      AccountMeta(fromPoolKeys.marketAsks, false),
      AccountMeta(fromPoolKeys.marketEventQueue, false),
      AccountMeta(fromPoolKeys.marketBaseVault, false),
      AccountMeta(fromPoolKeys.marketQuoteVault, false),
      AccountMetaReadonly(fromPoolKeys.marketAuthority, false),
      // user
      AccountMeta(userKeys.inTokenAccount, false),
      AccountMeta(userKeys.middleTokenAccount, false),
      AccountMeta(userKeys.middleStatusAccount, false),
      AccountMetaReadonly(userKeys.owner, true),
    ];

    return new TransactionInstruction({
      programId: ROUTE_PROGRAM_ID_V1,
      keys,
      data,
    });
  }

  static makeSwapOutFixedInInstruction({
    fromPoolKeys,
    toPoolKeys,
    userKeys,
    amountOut,
  }: RouteSwapOutFixedInInstructionParams) {
    const LAYOUT = struct([u8("instruction"), u64("amountOut")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 1,
        amountOut: parseBigNumberish(amountOut),
      },
      data,
    );

    const keys = [
      // system
      AccountMetaReadonly(SYSTEM_PROGRAM_ID, false),
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
      // amm
      AccountMetaReadonly(toPoolKeys.programId, false),
      AccountMetaReadonly(fromPoolKeys.id, false),
      AccountMeta(toPoolKeys.id, false),
      AccountMetaReadonly(toPoolKeys.authority, false),
      AccountMeta(toPoolKeys.openOrders, false),
      AccountMeta(toPoolKeys.baseVault, false),
      AccountMeta(toPoolKeys.quoteVault, false),
      // serum
      AccountMetaReadonly(toPoolKeys.marketProgramId, false),
      AccountMeta(toPoolKeys.marketId, false),
      AccountMeta(toPoolKeys.marketBids, false),
      AccountMeta(toPoolKeys.marketAsks, false),
      AccountMeta(toPoolKeys.marketEventQueue, false),
      AccountMeta(toPoolKeys.marketBaseVault, false),
      AccountMeta(toPoolKeys.marketQuoteVault, false),
      AccountMetaReadonly(toPoolKeys.marketAuthority, false),
      // user
      AccountMeta(userKeys.middleTokenAccount, false),
      AccountMeta(userKeys.outTokenAccount, false),
      AccountMeta(userKeys.middleStatusAccount, false),
      AccountMetaReadonly(userKeys.owner, true),
    ];

    return new TransactionInstruction({
      programId: ROUTE_PROGRAM_ID_V1,
      keys,
      data,
    });
  }

  // static makeSwapInFixedOutInstruction() {}

  // static makeSwapOutFixedOutInstruction() {}

  /* ================= compute data ================= */
  // static computeAmountOut() {}

  // static computeAmountIn() {}
}
