import { PublicKey, TransactionInstruction } from "@solana/web3.js";

import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, intersection, Logger, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID, uniq,
} from "../common";
import { BigNumberish, Currency, CurrencyAmount, parseBigNumberish, Percent, Token, TokenAmount } from "../entity";
import { Liquidity, LiquidityPoolInfo, LiquidityPoolKeys, SwapSide } from "../liquidity";
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

export interface RouteSwapInFixedInInstructionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  userKeys: Omit<RouteUserKeys, "outTokenAccount">;
  amountIn: BigNumberish;
  amountOut: BigNumberish;
}

export interface RouteSwapOutFixedInInstructionParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  userKeys: Omit<RouteUserKeys, "inTokenAccount">;
}

export interface RouteComputeAmountOutParams {
  fromPoolKeys: LiquidityPoolKeys;
  fromPoolInfo: LiquidityPoolInfo;
  toPoolKeys: LiquidityPoolKeys;
  toPoolInfo: LiquidityPoolInfo;
  amountIn: CurrencyAmount | TokenAmount;
  currencyOut: Currency | Token;
  slippage: Percent;
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
    amountOut,
  }: RouteSwapInFixedInInstructionParams) {
    const LAYOUT = struct([u8("instruction"), u64("amountIn"), u64("amountOut")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 0,
        amountIn: parseBigNumberish(amountIn),
        amountOut: parseBigNumberish(amountOut),
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

  static makeSwapOutFixedInInstruction({ fromPoolKeys, toPoolKeys, userKeys }: RouteSwapOutFixedInInstructionParams) {
    const LAYOUT = struct([u8("instruction")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 1,
      },
      data,
    );

    const keys = [
      // system
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
  static computeAmountOut({
    fromPoolKeys,
    toPoolKeys,
    fromPoolInfo,
    toPoolInfo,
    amountIn,
    currencyOut,
    slippage,
  }: RouteComputeAmountOutParams) {
    const fromPoolMints = [fromPoolKeys.baseMint.toBase58(), fromPoolKeys.quoteMint.toBase58()];
    const toPoolMints = [toPoolKeys.baseMint.toBase58(), toPoolKeys.quoteMint.toBase58()];
    const mints = [...fromPoolMints, ...toPoolMints];
    const decimals = [
      fromPoolInfo.baseDecimals,
      fromPoolInfo.quoteDecimals,
      toPoolInfo.baseDecimals,
      toPoolInfo.quoteDecimals,
    ];

    logger.assertArgument(uniq(mints).length === 3, "pools cannot be routed", "pools", {
      fromPoolKeys,
      toPoolKeys,
    });

    const _mints = intersection(fromPoolMints, toPoolMints);
    logger.assertArgument(_mints.length === 1, "cannot found middle token of two pools", "pools", {
      fromPoolKeys,
      toPoolKeys,
    });

    const _middleMint = _mints[0];
    const index = mints.indexOf(_middleMint);
    logger.assertArgument(index !== -1, "cannot found middle token", "pools", {
      fromPoolKeys,
      toPoolKeys,
    });

    const middleMintDecimals = decimals[index];
    const middleMint = new PublicKey(_middleMint);
    const middleToken = new Token(middleMint, middleMintDecimals);
    logger.debug("middleMint:", _middleMint);

    // TODO slippage and amount out
    const { amountOut: middleAmountOut, minAmountOut: minMiddleAmountOut } = Liquidity.computeAmountOut({
      poolKeys: fromPoolKeys,
      poolInfo: fromPoolInfo,
      amountIn,
      currencyOut: middleToken,
      slippage,
    });
    const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
      poolKeys: toPoolKeys,
      poolInfo: toPoolInfo,
      amountIn: middleAmountOut,
      currencyOut,
      slippage,
    });

    return {
      // middleAmountOut,
      // minMiddleAmountOut,
      amountOut,
      minAmountOut,
    };
  }

  // static computeAmountIn() {}
}
