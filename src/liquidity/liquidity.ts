import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, Logger, PublicKeyIsh, TOKEN_PROGRAM_ID,
  validateAndParsePublicKey,
} from "../common";
import { BigNumberIsh, parseBigNumberIsh } from "../entity";
import { struct, u64, u8 } from "../marshmallow";
import {
  LIQUIDITY_PROGRAMID_TO_VERSION, LIQUIDITY_VERSION_TO_PROGRAMID,
  LIQUIDITY_VERSION_TO_SERUM_VERSION,
} from "./id";
import { LIQUIDITY_VERSION_TO_STATE_LAYOUT } from "./layout";
import { LiquidityPoolJsonInfo } from "./type";

const logger = new Logger("Liquidity");

/* ================= pool keys ================= */
export type LiquidityPoolKeysV4 = {
  [T in keyof LiquidityPoolJsonInfo]: LiquidityPoolJsonInfo[T] extends string ? PublicKey : LiquidityPoolJsonInfo[T];
};

export type LiquidityPoolKeys = LiquidityPoolKeysV4;

export interface LiquidityUserKeys {
  baseTokenAccount: PublicKey;
  quoteTokenAccount: PublicKey;
  lpTokenAccount: PublicKey;
  owner: PublicKey;
}

/* ================= add liquidity instruction ================= */
export interface AddLiquidityInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: LiquidityUserKeys;
  maxBaseAmountIn: BigNumberIsh;
  maxQuoteAmountIn: BigNumberIsh;
  fixedSide: "base" | "quote";
}

export type AddLiquidityInstructionParams = AddLiquidityInstructionParamsV4;

/* ================= remove liquidity instruction ================= */
export interface RemoveLiquidityInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: LiquidityUserKeys;
  amountIn: BigNumberIsh;
}

export type RemoveLiquidityInstructionParams = RemoveLiquidityInstructionParamsV4;

/* ================= swap instruction ================= */
export interface SwapInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: Omit<LiquidityUserKeys, "lpTokenAccount">;
  amountIn: BigNumberIsh;
  // minimum amount out
  minAmountOut: BigNumberIsh;
  // buy: quote => base
  // sell: base => quote
  side: "buy" | "sell";
}

export type SwapInstructionParams = SwapInstructionParamsV4;

/* ================= simulate instruction ================= */
export interface MakeSimulatePoolInfoInstructionParams {
  poolKeys: LiquidityPoolKeys;
}

export interface MakeSimulatePoolInfoTransactionParams {
  connection: Connection;
  poolKeys: LiquidityPoolKeys;
}

export class Liquidity {
  /* ================= static functions ================= */
  static getProgramId(version: number) {
    const programId = LIQUIDITY_VERSION_TO_PROGRAMID[version];
    if (!programId) {
      return logger.throwArgumentError("invalid version", "version", version);
    }

    return new PublicKey(programId);
  }

  static getVersion(programId: PublicKeyIsh) {
    const programIdPubKey = validateAndParsePublicKey(programId);
    const programIdString = programIdPubKey.toBase58();

    const version = LIQUIDITY_PROGRAMID_TO_VERSION[programIdString];
    if (!version) {
      return logger.throwArgumentError("invalid program id", "programId", programIdString);
    }

    return version;
  }

  static getSerumVersion(params: { version?: number; programId?: PublicKeyIsh }) {
    let version = 0;

    if (params.programId) {
      version = this.getVersion(params.programId);
    }

    if (params.version) {
      version = params.version;
    }

    const serumVersion = LIQUIDITY_VERSION_TO_SERUM_VERSION[version];
    if (!serumVersion) {
      return logger.throwArgumentError("invalid params", "params", params);
    }

    return serumVersion;
  }

  static getStateLayout(version: number) {
    const STATE_LAYOUT = LIQUIDITY_VERSION_TO_STATE_LAYOUT[version];

    if (!STATE_LAYOUT) {
      return logger.throwArgumentError("invalid version", "version", version);
    }

    return STATE_LAYOUT;
  }

  static getLayouts(params: { version?: number; programId?: PublicKeyIsh }) {
    let version = 0;

    if (params.programId) {
      version = this.getVersion(params.programId);
    }
    if (params.version) {
      version = params.version;
    }

    return { state: this.getStateLayout(version) };
  }

  static async getAuthority({ programId }: { programId: PublicKey }) {
    const { publicKey } = await findProgramAddress(
      // new Uint8Array(Buffer.from('amm authority'.replace('\u00A0', ' '), 'utf-8'))
      [Buffer.from([97, 109, 109, 32, 97, 117, 116, 104, 111, 114, 105, 116, 121])],
      programId,
    );
    return publicKey;
  }

  /* ================= instructions ================= */
  /* ================= add liquidity ================= */
  static makeAddLiquidityInstruction(params: AddLiquidityInstructionParams) {
    const { poolKeys } = params;
    const { programId } = poolKeys;
    const version = this.getVersion(programId);

    if (version === 4) {
      return this.makeAddLiquidityInstructionV4(params);
    }

    return logger.throwArgumentError("invalid program id", "params.poolKeys.programId", programId.toBase58());
  }

  static makeAddLiquidityInstructionV4(params: AddLiquidityInstructionParamsV4) {
    const { poolKeys, userKeys, maxBaseAmountIn, maxQuoteAmountIn, fixedSide } = params;

    const LAYOUT = struct([u8("instruction"), u64("maxBaseAmountIn"), u64("maxQuoteAmountIn"), u64("fixedSide")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 3,
        maxBaseAmountIn: parseBigNumberIsh(maxBaseAmountIn),
        maxQuoteAmountIn: parseBigNumberIsh(maxQuoteAmountIn),
        fixedSide: parseBigNumberIsh(fixedSide === "base" ? 0 : 1),
      },
      data,
    );

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
      // amm
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMetaReadonly(poolKeys.openOrders, false),
      AccountMeta(poolKeys.targetOrders, false),
      AccountMeta(poolKeys.lpMint, false),
      AccountMeta(poolKeys.baseVault, false),
      AccountMeta(poolKeys.quoteVault, false),
      // serum
      AccountMetaReadonly(poolKeys.marketId, false),
      // user
      AccountMeta(userKeys.baseTokenAccount, false),
      AccountMeta(userKeys.quoteTokenAccount, false),
      AccountMeta(userKeys.lpTokenAccount, false),
      AccountMetaReadonly(userKeys.owner, true),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  /* ================= remove liquidity ================= */
  static makeRemoveLiquidityInstruction(params: RemoveLiquidityInstructionParams) {
    const { poolKeys } = params;
    const { programId } = poolKeys;
    const version = this.getVersion(programId);

    if (version === 4) {
      return this.makeRemoveLiquidityInstructionV4(params);
    }

    return logger.throwArgumentError("Unsupported program id", "params.poolKeys.programId", programId.toBase58());
  }

  static makeRemoveLiquidityInstructionV4(params: RemoveLiquidityInstructionParamsV4) {
    const { poolKeys, userKeys, amountIn } = params;

    const LAYOUT = struct([u8("instruction"), u64("amountIn")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 4,
        amountIn: parseBigNumberIsh(amountIn),
      },
      data,
    );

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
      // amm
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMeta(poolKeys.openOrders, false),
      AccountMeta(poolKeys.targetOrders, false),
      AccountMeta(poolKeys.lpMint, false),
      AccountMeta(poolKeys.baseVault, false),
      AccountMeta(poolKeys.quoteVault, false),
      AccountMeta(poolKeys.withdrawQueue, false),
      AccountMeta(poolKeys.tempLpVault, false),
      // serum
      AccountMetaReadonly(poolKeys.marketProgramId, false),
      AccountMeta(poolKeys.marketId, false),
      AccountMeta(poolKeys.marketBaseVault, false),
      AccountMeta(poolKeys.marketQuoteVault, false),
      AccountMetaReadonly(poolKeys.marketVaultSigner, false),
      // user
      AccountMeta(userKeys.lpTokenAccount, false),
      AccountMeta(userKeys.baseTokenAccount, false),
      AccountMeta(userKeys.quoteTokenAccount, false),
      AccountMetaReadonly(userKeys.owner, true),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  /* ================= swap ================= */
  static makeSwapInstruction(params: SwapInstructionParams) {
    const { poolKeys } = params;
    const { programId } = poolKeys;
    const version = this.getVersion(programId);

    if (version === 4) {
      return this.makeSwapInstructionV4(params);
    }

    return logger.throwArgumentError("Unsupported program id", "params.poolKeys.programId", programId.toBase58());
  }

  static makeSwapInstructionV4(params: SwapInstructionParamsV4) {
    const { poolKeys, userKeys, amountIn, minAmountOut, side } = params;

    const LAYOUT = struct([u8("instruction"), u64("amountIn"), u64("minAmountOut")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 9,
        amountIn: parseBigNumberIsh(amountIn),
        minAmountOut: parseBigNumberIsh(minAmountOut),
      },
      data,
    );

    const userTokenAccounts = [userKeys.baseTokenAccount, userKeys.quoteTokenAccount];
    if (side === "buy") {
      userTokenAccounts.reverse();
    }

    const keys = [
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
      // amm
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMeta(poolKeys.openOrders, false),
      AccountMeta(poolKeys.targetOrders, false),
      AccountMeta(poolKeys.baseVault, false),
      AccountMeta(poolKeys.quoteVault, false),
      // serum
      AccountMetaReadonly(poolKeys.marketProgramId, false),
      AccountMeta(poolKeys.marketId, false),
      AccountMeta(poolKeys.marketBids, false),
      AccountMeta(poolKeys.marketAsks, false),
      AccountMeta(poolKeys.marketEventQueue, false),
      AccountMeta(poolKeys.marketBaseVault, false),
      AccountMeta(poolKeys.marketQuoteVault, false),
      AccountMetaReadonly(poolKeys.marketVaultSigner, false),
      // user
      ...userTokenAccounts.map((tokenAccount) => AccountMeta(tokenAccount, false)),
      AccountMetaReadonly(userKeys.owner, true),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  /* ================= simulate ================= */
  static makeSimulatePoolInfoInstruction(params: MakeSimulatePoolInfoInstructionParams) {
    const { poolKeys } = params;

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
      AccountMetaReadonly(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMetaReadonly(poolKeys.openOrders, false),
      AccountMetaReadonly(poolKeys.baseVault, false),
      AccountMetaReadonly(poolKeys.quoteVault, false),
      AccountMetaReadonly(poolKeys.lpMint, false),
      // serum
      AccountMetaReadonly(poolKeys.marketId, false),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  // static makeSimulatePoolInfoTransaction(connection: Connection) {}
}
