import { Connection, PublicKey, Signer, Transaction, TransactionInstruction } from "@solana/web3.js";
import { intersection, xor } from "lodash";

import { Base, TokenAccount, UnsignedTransactionAndSigners } from "../base";
import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, Logger, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID,
} from "../common";
import {
  BigNumberish, Currency, CurrencyAmount, parseBigNumberish, Percent, Price, Token, TokenAmount,
} from "../entity";
import { Liquidity, LiquidityPoolInfo, LiquidityPoolKeys, SwapSide } from "../liquidity";
import { ModelDataPubkey } from "../liquidity/stable";
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

export interface RouteSwapTransactionParams {
  connection: Connection;
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  userKeys: {
    tokenAccounts: TokenAccount[];
    owner: PublicKey;
    // dont support payer, txn size limited
  };
  amountIn: CurrencyAmount | TokenAmount;
  amountOut: CurrencyAmount | TokenAmount;
  fixedSide: SwapSide;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}

export interface RouteComputeAmountOutParams {
  fromPoolKeys: LiquidityPoolKeys;
  toPoolKeys: LiquidityPoolKeys;
  fromPoolInfo: LiquidityPoolInfo;
  toPoolInfo: LiquidityPoolInfo;
  amountIn: CurrencyAmount | TokenAmount;
  currencyOut: Currency | Token;
  slippage: Percent;
}

export class Route extends Base {
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
  static getAssociatedMiddleStatusAccount({
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
    const { publicKey } = findProgramAddress(
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

    let keys;

    if (fromPoolKeys.version === 4) {
      LAYOUT.encode(
        {
          instruction: 0,
          amountIn: parseBigNumberish(amountIn),
          amountOut: parseBigNumberish(amountOut),
        },
        data,
      );
      keys = [
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
    } else {
      LAYOUT.encode(
        {
          instruction: 2,
          amountIn: parseBigNumberish(amountIn),
          amountOut: parseBigNumberish(amountOut),
        },
        data,
      );
      keys = [
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

        AccountMetaReadonly(ModelDataPubkey, false),
        // serum
        AccountMetaReadonly(fromPoolKeys.marketProgramId, false),
        AccountMeta(fromPoolKeys.marketId, false),
        AccountMeta(fromPoolKeys.marketBids, false),
        AccountMeta(fromPoolKeys.marketAsks, false),
        AccountMeta(fromPoolKeys.marketEventQueue, false),
        AccountMeta(fromPoolKeys.id, false),
        AccountMeta(fromPoolKeys.id, false),
        AccountMeta(fromPoolKeys.id, false),
        // user
        AccountMeta(userKeys.inTokenAccount, false),
        AccountMeta(userKeys.middleTokenAccount, false),
        AccountMeta(userKeys.middleStatusAccount, false),
        AccountMetaReadonly(userKeys.owner, true),
      ];
    }

    return new TransactionInstruction({
      programId: ROUTE_PROGRAM_ID_V1,
      keys,
      data,
    });
  }

  static makeSwapOutFixedInInstruction({ fromPoolKeys, toPoolKeys, userKeys }: RouteSwapOutFixedInInstructionParams) {
    const LAYOUT = struct([u8("instruction")]);
    const data = Buffer.alloc(LAYOUT.span);

    let keys;

    if (toPoolKeys.version === 4) {
      LAYOUT.encode(
        {
          instruction: 1,
        },
        data,
      );
      keys = [
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
    } else {
      LAYOUT.encode(
        {
          instruction: 3,
        },
        data,
      );
      keys = [
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

        AccountMetaReadonly(ModelDataPubkey, false),
        // serum
        AccountMetaReadonly(toPoolKeys.marketProgramId, false),
        AccountMeta(toPoolKeys.marketId, false),
        AccountMeta(toPoolKeys.marketBids, false),
        AccountMeta(toPoolKeys.marketAsks, false),
        AccountMeta(toPoolKeys.marketEventQueue, false),
        AccountMeta(toPoolKeys.id, false),
        AccountMeta(toPoolKeys.id, false),
        AccountMeta(toPoolKeys.id, false),
        // user
        AccountMeta(userKeys.middleTokenAccount, false),
        AccountMeta(userKeys.outTokenAccount, false),
        AccountMeta(userKeys.middleStatusAccount, false),
        AccountMetaReadonly(userKeys.owner, true),
      ];
    }

    return new TransactionInstruction({
      programId: ROUTE_PROGRAM_ID_V1,
      keys,
      data,
    });
  }

  static async makeSwapTransaction(params: RouteSwapTransactionParams) {
    const { connection, fromPoolKeys, toPoolKeys, userKeys, amountIn, amountOut, fixedSide, config } = params;
    const { tokenAccounts, owner } = userKeys;

    logger.debug("amountIn:", amountIn);
    logger.debug("amountOut:", amountOut);
    logger.assertArgument(
      !amountIn.isZero() && !amountOut.isZero(),
      "amounts must greater than zero",
      "currencyAmounts",
      {
        amountIn: amountIn.toFixed(),
        amountOut: amountOut.toFixed(),
      },
    );

    const { bypassAssociatedCheck } = {
      // default
      ...{ bypassAssociatedCheck: false },
      // custom
      ...config,
    };

    // handle currency in & out (convert SOL to WSOL)
    const tokenIn = amountIn instanceof TokenAmount ? amountIn.token : Token.WSOL;
    const tokenOut = amountOut instanceof TokenAmount ? amountOut.token : Token.WSOL;

    const tokenAccountIn = this._selectTokenAccount({
      tokenAccounts,
      mint: tokenIn.mint,
      owner,
      config: { associatedOnly: false },
    });
    const tokenAccountOut = this._selectTokenAccount({
      tokenAccounts,
      mint: tokenOut.mint,
      owner,
    });

    const fromPoolMints = [fromPoolKeys.baseMint.toBase58(), fromPoolKeys.quoteMint.toBase58()];
    const toPoolMints = [toPoolKeys.baseMint.toBase58(), toPoolKeys.quoteMint.toBase58()];
    const intersectionMints = intersection(fromPoolMints, toPoolMints);
    const _middleMint = intersectionMints[0];
    const middleMint = new PublicKey(_middleMint);
    const tokenAccountMiddle = this._selectTokenAccount({
      tokenAccounts,
      mint: middleMint,
      owner,
    });

    const [amountInRaw, amountOutRaw] = [amountIn.raw, amountOut.raw];

    const setupInstructions: TransactionInstruction[] = [];
    const setupSigners: Signer[] = [];
    const swapInstructions: TransactionInstruction[] = [];

    const _tokenAccountIn = await this._handleTokenAccount({
      connection,
      side: "in",
      amount: amountInRaw,
      mint: tokenIn.mint,
      tokenAccount: tokenAccountIn,
      owner,
      frontInstructions: setupInstructions,
      signers: setupSigners,
      bypassAssociatedCheck,
    });
    const _tokenAccountOut = await this._handleTokenAccount({
      connection,
      side: "out",
      amount: 0,
      mint: tokenOut.mint,
      tokenAccount: tokenAccountOut,
      owner,
      frontInstructions: setupInstructions,
      signers: setupSigners,
      bypassAssociatedCheck,
    });
    const _tokenAccountMiddle = await this._handleTokenAccount({
      connection,
      side: "in",
      amount: 0,
      mint: middleMint,
      tokenAccount: tokenAccountMiddle,
      owner,
      frontInstructions: setupInstructions,
      signers: setupSigners,
      bypassAssociatedCheck,
    });

    swapInstructions.push(
      ...this.makeSwapInstruction({
        fromPoolKeys,
        toPoolKeys,
        userKeys: {
          inTokenAccount: _tokenAccountIn,
          outTokenAccount: _tokenAccountOut,
          middleTokenAccount: _tokenAccountMiddle,
          middleStatusAccount: this.getAssociatedMiddleStatusAccount({
            programId: ROUTE_PROGRAM_ID_V1,
            fromPoolId: fromPoolKeys.id,
            middleMint,
            owner,
          }),
          owner,
        },
        amountIn: amountInRaw,
        amountOut: amountOutRaw,
        fixedSide,
      }),
    );

    let setupTransaction: UnsignedTransactionAndSigners | null = null;
    let swapTransaction: UnsignedTransactionAndSigners | null = null;

    if (setupInstructions.length > 0) {
      setupTransaction = {
        transaction: new Transaction().add(...setupInstructions),
        signers: setupSigners,
      };
    }
    if (swapInstructions.length > 0) {
      swapTransaction = {
        transaction: new Transaction().add(...swapInstructions),
        signers: [],
      };
    }

    return { setupTransaction, swapTransaction };
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
    const { swap: fromPoolSwapEnabled } = Liquidity.getEnabledFeatures(fromPoolInfo);
    const { swap: toPoolSwapEnabled } = Liquidity.getEnabledFeatures(toPoolInfo);
    logger.assertArgument(fromPoolSwapEnabled && toPoolSwapEnabled, "pools swap not enabled", "pools", {
      fromPoolKeys,
      toPoolKeys,
      fromPoolInfo,
      toPoolInfo,
    });

    const tokenIn = amountIn instanceof TokenAmount ? amountIn.token : Token.WSOL;
    const tokenOut = currencyOut instanceof Token ? currencyOut : Token.WSOL;

    logger.assertArgument(
      Liquidity.includesToken(tokenIn, fromPoolKeys) && Liquidity.includesToken(tokenOut, toPoolKeys),
      "pools cannot be routed",
      "pools",
      {
        fromPoolKeys,
        toPoolKeys,
      },
    );

    const fromPoolMints = [fromPoolKeys.baseMint.toBase58(), fromPoolKeys.quoteMint.toBase58()];
    const toPoolMints = [toPoolKeys.baseMint.toBase58(), toPoolKeys.quoteMint.toBase58()];
    const mints = [...fromPoolMints, ...toPoolMints];
    const decimals = [
      fromPoolInfo.baseDecimals,
      fromPoolInfo.quoteDecimals,
      toPoolInfo.baseDecimals,
      toPoolInfo.quoteDecimals,
    ];
    const mintIn = tokenIn.mint.toBase58();
    const mintOut = tokenOut.mint.toBase58();

    const xorMints = xor(fromPoolMints, toPoolMints);
    logger.assertArgument(
      xorMints.length === 2 && xorMints.includes(mintIn) && xorMints.includes(mintOut),
      "xor tokens not match",
      "pools",
      {
        fromPoolKeys,
        toPoolKeys,
      },
    );

    const intersectionMints = intersection(fromPoolMints, toPoolMints);
    logger.assertArgument(intersectionMints.length === 1, "cannot found middle token of two pools", "pools", {
      fromPoolKeys,
      toPoolKeys,
    });

    const _middleMint = intersectionMints[0];
    const index = mints.indexOf(_middleMint);
    // logger.assertArgument(index !== -1, "cannot found middle token", "pools", {
    //   fromPoolKeys,
    //   toPoolKeys,
    // });
    const middleMintDecimals = decimals[index];
    const middleMint = new PublicKey(_middleMint);
    const middleToken = new Token(middleMint, middleMintDecimals);

    logger.debug("from pool:", fromPoolKeys);
    logger.debug("to pool:", toPoolKeys);
    logger.debug("intersection mints:", intersectionMints);
    logger.debug("xor mints:", xorMints);
    logger.debug("middleMint:", _middleMint);

    // TODO slippage and amount out
    const {
      // amountOut: middleAmountOut,
      minAmountOut: minMiddleAmountOut,
      priceImpact: firstPriceImpact,
      fee: firstFee,
    } = Liquidity.computeAmountOut({
      poolKeys: fromPoolKeys,
      poolInfo: fromPoolInfo,
      amountIn,
      currencyOut: middleToken,
      slippage,
    });
    const {
      amountOut,
      minAmountOut,
      priceImpact: secondPriceImpact,
      fee: secondFee,
    } = Liquidity.computeAmountOut({
      poolKeys: toPoolKeys,
      poolInfo: toPoolInfo,
      amountIn: minMiddleAmountOut,
      currencyOut,
      slippage,
    });

    let executionPrice: Price | null = null;
    const amountInRaw = amountIn.raw;
    const amountOutRaw = amountOut.raw;
    const currencyIn = amountIn instanceof TokenAmount ? amountIn.token : amountIn.currency;
    if (!amountInRaw.isZero() && !amountOutRaw.isZero()) {
      executionPrice = new Price(currencyIn, amountInRaw, currencyOut, amountOutRaw);
      logger.debug("executionPrice:", `1 ${currencyIn.symbol} ≈ ${executionPrice.toFixed()} ${currencyOut.symbol}`);
      logger.debug(
        "executionPrice invert:",
        `1 ${currencyOut.symbol} ≈ ${executionPrice.invert().toFixed()} ${currencyIn.symbol}`,
      );
    }

    return {
      // middleAmountOut,
      // minMiddleAmountOut,
      amountOut,
      minAmountOut,
      executionPrice,
      priceImpact: firstPriceImpact.add(secondPriceImpact),
      fee: [firstFee, secondFee],
    };
  }

  // static computeAmountIn() {}
}
