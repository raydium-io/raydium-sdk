import { AccountInfo, Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, getMultipleAccountsInfo, GetMultipleAccountsInfoConfig, Logger,
  parseSimulateLog, parseSimulateValue, simulateMultipleInstruction, SYSTEM_PROGRAM_ID, SYSVAR_RENT_PUBKEY,
  TOKEN_PROGRAM_ID,
} from "../common";
import { BigNumberish, ONE, parseBigNumberish, Percent } from "../entity";
import { struct, u64, u8 } from "../marshmallow";
import { Market } from "../serum";

import {
  LIQUIDITY_PROGRAMID_TO_VERSION, LIQUIDITY_VERSION_TO_PROGRAMID, LIQUIDITY_VERSION_TO_SERUM_VERSION,
} from "./id";
import { LIQUIDITY_VERSION_TO_STATE_LAYOUT, LiquidityStateLayout } from "./layout";
import { LiquidityPoolJsonInfo } from "./type";

const logger = new Logger("Liquidity");

// buy: quote => base
// sell: base => quote
export type TradeSide = "buy" | "sell";

export type FixedSide = "base" | "quote";

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
  maxBaseAmountIn: BigNumberish;
  maxQuoteAmountIn: BigNumberish;
  fixedSide: FixedSide;
}

export type AddLiquidityInstructionParams = AddLiquidityInstructionParamsV4;

/* ================= remove liquidity instruction ================= */
export interface RemoveLiquidityInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: LiquidityUserKeys;
  amountIn: BigNumberish;
}

export type RemoveLiquidityInstructionParams = RemoveLiquidityInstructionParamsV4;

/* ================= swap instruction ================= */
export type SwapFixedInInstructionParamsV4 = {
  poolKeys: LiquidityPoolKeys;
  userKeys: Omit<LiquidityUserKeys, "lpTokenAccount">;
  amountIn: BigNumberish;
  // minimum amount out
  minAmountOut: BigNumberish;
  tradeSide: TradeSide;
};

export type SwapFixedOutInstructionParamsV4 = {
  poolKeys: LiquidityPoolKeys;
  userKeys: Omit<LiquidityUserKeys, "lpTokenAccount">;
  // maximum amount in
  maxAmountIn: BigNumberish;
  amountOut: BigNumberish;
  tradeSide: TradeSide;
};

// https://github.com/maninak/ts-xor
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;

export type SwapInstructionParams = { fixedSide: FixedSide } & XOR<
  SwapFixedInInstructionParamsV4,
  SwapFixedOutInstructionParamsV4
>;

export interface AssociatedPoolKeysV4
  extends Omit<
    LiquidityPoolKeysV4,
    "marketAuthority" | "marketBaseVault" | "marketQuoteVault" | "marketBids" | "marketAsks" | "marketEventQueue"
  > {
  nonce: number;
}

export type AssociatedPoolKeys = AssociatedPoolKeysV4;

/* ================= create pool instruction ================= */
export interface CreatePoolInstructionParamsV4 {
  poolKeys: AssociatedPoolKeysV4;
  userKeys: {
    payer: PublicKey;
  };
}

export type CreatePoolInstructionParams = CreatePoolInstructionParamsV4;

/* ================= init pool instruction ================= */
export interface InitPoolInstructionParamsV4 {
  poolKeys: AssociatedPoolKeysV4;
  userKeys: {
    lpTokenAccount: PublicKey;
    payer: PublicKey;
  };
}

export type InitPoolInstructionParams = InitPoolInstructionParamsV4;

export interface GetLiquidityMultipleInfoParams {
  connection: Connection;
  pools: LiquidityPoolKeys[];
  config?: GetMultipleAccountsInfoConfig;
}

export interface GetQuoteParams {
  amount: BigNumberish;
  fixedSide: FixedSide;
  baseReserve: BigNumberish;
  quoteReserve: BigNumberish;
}

export interface GetAmountBParams extends Omit<GetQuoteParams, "amount"> {
  amountA: BigNumberish;
  slippage: Percent;
}

export const LIQUIDITY_FEES_NUMERATOR = new BN(9975);
export const LIQUIDITY_FEES_DENOMINATOR = new BN(10000);

export interface GetAmountOutParams {
  amountIn: BigNumberish;
  baseReserve: BigNumberish;
  quoteReserve: BigNumberish;
  tradeSide: TradeSide;
  slippage?: Percent;
}

export interface GetAmountInParams extends Omit<GetAmountOutParams, "amountIn"> {
  amountOut: BigNumberish;
}

export class Liquidity {
  /* ================= static functions ================= */
  static getProgramId(version: number) {
    const programId = LIQUIDITY_VERSION_TO_PROGRAMID[version];
    if (!programId) {
      return logger.throwArgumentError("invalid version", "version", version);
    }

    return programId;
  }

  static getVersion(programId: PublicKey) {
    const programIdString = programId.toBase58();

    const version = LIQUIDITY_PROGRAMID_TO_VERSION[programIdString];
    if (!version) {
      return logger.throwArgumentError("invalid program id", "programId", programIdString);
    }

    return version;
  }

  static getSerumVersion(version: number) {
    const serumVersion = LIQUIDITY_VERSION_TO_SERUM_VERSION[version];
    if (!serumVersion) {
      return logger.throwArgumentError("invalid version", "version", version);
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

  static getLayouts(version: number) {
    return { state: this.getStateLayout(version) };
  }

  static async getAssociatedId({ programId, marketId }: { programId: PublicKey; marketId: PublicKey }) {
    const { publicKey } = await findProgramAddress(
      [programId.toBuffer(), marketId.toBuffer(), Buffer.from("amm_associated_seed", "utf-8")],
      programId,
    );
    return publicKey;
  }

  static getAssociatedAuthority({ programId }: { programId: PublicKey }) {
    return findProgramAddress(
      // new Uint8Array(Buffer.from('amm authority'.replace('\u00A0', ' '), 'utf-8'))
      [Buffer.from([97, 109, 109, 32, 97, 117, 116, 104, 111, 114, 105, 116, 121])],
      programId,
    );
  }

  static async getAssociatedBaseVault({ programId, marketId }: { programId: PublicKey; marketId: PublicKey }) {
    const { publicKey } = await findProgramAddress(
      [programId.toBuffer(), marketId.toBuffer(), Buffer.from("coin_vault_associated_seed", "utf-8")],
      programId,
    );
    return publicKey;
  }

  static async getAssociatedQuoteVault({ programId, marketId }: { programId: PublicKey; marketId: PublicKey }) {
    const { publicKey } = await findProgramAddress(
      [programId.toBuffer(), marketId.toBuffer(), Buffer.from("pc_vault_associated_seed", "utf-8")],
      programId,
    );
    return publicKey;
  }

  static async getAssociatedLpMint({ programId, marketId }: { programId: PublicKey; marketId: PublicKey }) {
    const { publicKey } = await findProgramAddress(
      [programId.toBuffer(), marketId.toBuffer(), Buffer.from("lp_mint_associated_seed", "utf-8")],
      programId,
    );
    return publicKey;
  }

  static async getAssociatedLpVault({ programId, marketId }: { programId: PublicKey; marketId: PublicKey }) {
    const { publicKey } = await findProgramAddress(
      [programId.toBuffer(), marketId.toBuffer(), Buffer.from("temp_lp_token_associated_seed", "utf-8")],
      programId,
    );
    return publicKey;
  }

  static async getAssociatedTargetOrders({ programId, marketId }: { programId: PublicKey; marketId: PublicKey }) {
    const { publicKey } = await findProgramAddress(
      [programId.toBuffer(), marketId.toBuffer(), Buffer.from("target_associated_seed", "utf-8")],
      programId,
    );
    return publicKey;
  }

  static async getAssociatedWithdrawQueue({ programId, marketId }: { programId: PublicKey; marketId: PublicKey }) {
    const { publicKey } = await findProgramAddress(
      [programId.toBuffer(), marketId.toBuffer(), Buffer.from("withdraw_associated_seed", "utf-8")],
      programId,
    );
    return publicKey;
  }

  static async getAssociatedOpenOrders({ programId, marketId }: { programId: PublicKey; marketId: PublicKey }) {
    const { publicKey } = await findProgramAddress(
      [programId.toBuffer(), marketId.toBuffer(), Buffer.from("open_order_associated_seed", "utf-8")],
      programId,
    );
    return publicKey;
  }

  static async getAssociatedPoolKeys({
    version,
    marketId,
    baseMint,
    quoteMint,
  }: {
    version: number;
    marketId: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
  }): Promise<AssociatedPoolKeys> {
    const programId = this.getProgramId(version);

    const id = await this.getAssociatedId({ programId, marketId });
    const lpMint = await this.getAssociatedLpMint({ programId, marketId });
    const { publicKey: authority, nonce } = await this.getAssociatedAuthority({ programId });
    const baseVault = await this.getAssociatedBaseVault({ programId, marketId });
    const quoteVault = await this.getAssociatedQuoteVault({ programId, marketId });
    const lpVault = await this.getAssociatedLpVault({ programId, marketId });
    const openOrders = await this.getAssociatedOpenOrders({ programId, marketId });
    const targetOrders = await this.getAssociatedTargetOrders({ programId, marketId });
    const withdrawQueue = await this.getAssociatedWithdrawQueue({ programId, marketId });

    const serumVersion = this.getSerumVersion(version);
    const serumProgramId = Market.getProgramId(serumVersion);

    return {
      // base
      id,
      baseMint,
      quoteMint,
      lpMint,
      // version
      version,
      programId,
      // keys
      authority,
      nonce,
      baseVault,
      quoteVault,
      lpVault,
      openOrders,
      targetOrders,
      withdrawQueue,
      // market version
      marketVersion: serumVersion,
      marketProgramId: serumProgramId,
      // market keys
      marketId,
    };
  }

  /* ================= instructions ================= */
  /* ================= add liquidity ================= */
  static makeAddLiquidityInstruction(params: AddLiquidityInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 4) {
      return this.makeAddLiquidityInstructionV4(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static makeAddLiquidityInstructionV4({
    poolKeys,
    userKeys,
    maxBaseAmountIn,
    maxQuoteAmountIn,
    fixedSide,
  }: AddLiquidityInstructionParamsV4) {
    const LAYOUT = struct([u8("instruction"), u64("maxBaseAmountIn"), u64("maxQuoteAmountIn"), u64("fixedSide")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 3,
        maxBaseAmountIn: parseBigNumberish(maxBaseAmountIn),
        maxQuoteAmountIn: parseBigNumberish(maxQuoteAmountIn),
        fixedSide: parseBigNumberish(fixedSide === "base" ? 0 : 1),
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
    const { version } = poolKeys;

    if (version === 4) {
      return this.makeRemoveLiquidityInstructionV4(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static makeRemoveLiquidityInstructionV4({ poolKeys, userKeys, amountIn }: RemoveLiquidityInstructionParamsV4) {
    const LAYOUT = struct([u8("instruction"), u64("amountIn")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 4,
        amountIn: parseBigNumberish(amountIn),
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
      AccountMeta(poolKeys.lpVault, false),
      // serum
      AccountMetaReadonly(poolKeys.marketProgramId, false),
      AccountMeta(poolKeys.marketId, false),
      AccountMeta(poolKeys.marketBaseVault, false),
      AccountMeta(poolKeys.marketQuoteVault, false),
      AccountMetaReadonly(poolKeys.marketAuthority, false),
      // user
      AccountMeta(userKeys.lpTokenAccount, false),
      AccountMeta(userKeys.baseTokenAccount, false),
      AccountMeta(userKeys.quoteTokenAccount, false),
      AccountMetaReadonly(userKeys.owner, true),
      // serum orderbook
      AccountMeta(poolKeys.marketEventQueue, false),
      AccountMeta(poolKeys.marketBids, false),
      AccountMeta(poolKeys.marketAsks, false),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  /* ================= swap ================= */
  static makeSwapInstruction(params: SwapInstructionParams) {
    const { poolKeys, userKeys, amountIn, minAmountOut, maxAmountIn, amountOut, tradeSide, fixedSide } = params;
    const { version } = poolKeys;

    if (version === 4) {
      if (
        ((tradeSide === "buy" && fixedSide === "quote") || (tradeSide === "sell" && fixedSide === "base")) &&
        amountIn &&
        minAmountOut
      )
        return this.makeSwapFixedInInstructionV4({ poolKeys, userKeys, amountIn, minAmountOut, tradeSide });
      else if (
        ((tradeSide === "buy" && fixedSide === "base") || (tradeSide === "sell" && fixedSide === "quote")) &&
        maxAmountIn &&
        amountOut
      )
        return this.makeSwapFixedOutInstructionV4({ poolKeys, userKeys, maxAmountIn, amountOut, tradeSide });
      else logger.throwArgumentError("invalid params", "params", params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static makeSwapFixedInInstructionV4({
    poolKeys,
    userKeys,
    amountIn,
    minAmountOut,
    tradeSide,
  }: SwapFixedInInstructionParamsV4) {
    const LAYOUT = struct([u8("instruction"), u64("amountIn"), u64("minAmountOut")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 9,
        amountIn: parseBigNumberish(amountIn),
        minAmountOut: parseBigNumberish(minAmountOut),
      },
      data,
    );

    const userTokenAccounts = [userKeys.baseTokenAccount, userKeys.quoteTokenAccount];
    if (tradeSide === "buy") {
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
      AccountMetaReadonly(poolKeys.marketAuthority, false),
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

  static makeSwapFixedOutInstructionV4({
    poolKeys,
    userKeys,
    maxAmountIn,
    amountOut,
    tradeSide,
  }: SwapFixedOutInstructionParamsV4) {
    const LAYOUT = struct([u8("instruction"), u64("maxAmountIn"), u64("amountOut")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 11,
        maxAmountIn: parseBigNumberish(maxAmountIn),
        amountOut: parseBigNumberish(amountOut),
      },
      data,
    );

    const userTokenAccounts = [userKeys.baseTokenAccount, userKeys.quoteTokenAccount];
    if (tradeSide === "buy") {
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
      AccountMetaReadonly(poolKeys.marketAuthority, false),
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

  /* ================= create pool ================= */
  static makeCreatePoolInstruction(params: CreatePoolInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 4) {
      return this.makeCreatePoolInstructionV4(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static async makeCreatePoolInstructionV4({ poolKeys, userKeys }: CreatePoolInstructionParamsV4) {
    const LAYOUT = struct([u8("instruction"), u8("nonce")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 10,
        nonce: poolKeys.nonce,
      },
      data,
    );

    const keys = [
      // system
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
      AccountMetaReadonly(SYSTEM_PROGRAM_ID, false),
      AccountMetaReadonly(SYSVAR_RENT_PUBKEY, false),
      // amm
      AccountMeta(poolKeys.targetOrders, false),
      AccountMeta(poolKeys.withdrawQueue, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMeta(poolKeys.lpMint, false),
      AccountMetaReadonly(poolKeys.baseMint, false),
      AccountMetaReadonly(poolKeys.quoteMint, false),
      AccountMeta(poolKeys.baseVault, false),
      AccountMeta(poolKeys.quoteVault, false),
      AccountMeta(poolKeys.lpVault, false),
      // serum
      AccountMetaReadonly(poolKeys.marketId, false),
      // user
      AccountMeta(userKeys.payer, true),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  /* ================= initialize pool ================= */
  static makeInitPoolInstruction(params: InitPoolInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 4) {
      return this.makeInitPoolInstructionV4(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static async makeInitPoolInstructionV4({ poolKeys, userKeys }: InitPoolInstructionParamsV4) {
    const LAYOUT = struct([u8("instruction"), u8("nonce")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 0,
        nonce: poolKeys.nonce,
      },
      data,
    );

    const keys = [
      // system
      AccountMetaReadonly(TOKEN_PROGRAM_ID, false),
      AccountMetaReadonly(SYSTEM_PROGRAM_ID, false),
      AccountMetaReadonly(SYSVAR_RENT_PUBKEY, false),
      // amm
      AccountMeta(poolKeys.id, false),
      AccountMetaReadonly(poolKeys.authority, false),
      AccountMeta(poolKeys.openOrders, false),
      AccountMeta(poolKeys.lpMint, false),
      AccountMetaReadonly(poolKeys.baseMint, false),
      AccountMetaReadonly(poolKeys.quoteMint, false),
      AccountMetaReadonly(poolKeys.baseVault, false),
      AccountMetaReadonly(poolKeys.quoteVault, false),
      AccountMeta(poolKeys.withdrawQueue, false),
      AccountMeta(poolKeys.targetOrders, false),
      AccountMeta(userKeys.lpTokenAccount, false),
      AccountMetaReadonly(poolKeys.lpVault, false),
      // serum
      AccountMetaReadonly(poolKeys.marketProgramId, false),
      AccountMetaReadonly(poolKeys.marketId, false),
      // user
      AccountMeta(userKeys.payer, true),
    ];

    return new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });
  }

  /* ================= simulate ================= */
  static makeSimulatePoolInfoInstruction({ poolKeys }: { poolKeys: LiquidityPoolKeys }) {
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

  static async getPools(connection: Connection, config?: GetMultipleAccountsInfoConfig) {
    const { batchRequest, commitment } = {
      // default
      ...{},
      // custom
      ...config,
    };

    // supported versions
    const supported = Object.keys(LIQUIDITY_VERSION_TO_STATE_LAYOUT).map((v) => {
      const version = Number(v);
      const serumVersion = this.getSerumVersion(version);
      const serumProgramId = Market.getProgramId(serumVersion);
      return {
        version,
        programId: this.getProgramId(version),
        serumVersion,
        serumProgramId,
        stateLayout: this.getStateLayout(version),
      };
    });

    let poolsAccountInfo: {
      pubkey: PublicKey;
      account: AccountInfo<Buffer>;

      version: number;
      programId: PublicKey;
      serumVersion: number;
      serumProgramId: PublicKey;
      stateLayout: LiquidityStateLayout;
    }[][] = [];
    try {
      poolsAccountInfo = await Promise.all(
        supported.map(({ programId, version, serumVersion, serumProgramId, stateLayout }) =>
          connection
            .getProgramAccounts(programId, {
              filters: [{ dataSize: stateLayout.span }],
            })
            .then((accounts) => {
              return accounts.map((info) => {
                return {
                  ...info,
                  ...{ version, programId, serumVersion, serumProgramId, stateLayout },
                };
              });
            }),
        ),
      );
    } catch (error) {
      if (error instanceof Error) {
        return logger.throwError("failed to get all liquidity pools", Logger.errors.RPC_ERROR, {
          message: error.message,
        });
      }
    }

    const flatPoolsAccountInfo = poolsAccountInfo.flat();
    // temp pool keys without market keys
    const tempPoolsKeys: Omit<
      LiquidityPoolKeys,
      "marketBaseVault" | "marketQuoteVault" | "marketBids" | "marketAsks" | "marketEventQueue"
    >[] = [];

    for (const {
      pubkey,
      account: accountInfo,
      version,
      programId,
      serumVersion,
      serumProgramId,
      stateLayout: LIQUIDITY_STATE_LAYOUT,
    } of flatPoolsAccountInfo) {
      if (!accountInfo) {
        return logger.throwArgumentError("empty state account info", "pool.id", pubkey.toBase58());
      }

      const { data } = accountInfo;
      if (data.length !== LIQUIDITY_STATE_LAYOUT.span) {
        return logger.throwArgumentError("invalid state data length", "pool.id", pubkey.toBase58());
      }

      const {
        status,
        baseMint,
        quoteMint,
        lpMint,
        openOrders,
        targetOrders,
        baseVault,
        quoteVault,
        withdrawQueue,
        lpVault,
        marketId,
      } = LIQUIDITY_STATE_LAYOUT.decode(data);

      // uninitialized
      if (status.isZero()) {
        continue;
      }

      const { publicKey: authority } = await Liquidity.getAssociatedAuthority({ programId });
      const { publicKey: marketAuthority } = await Market.getAssociatedAuthority({
        programId: serumProgramId,
        marketId,
      });

      tempPoolsKeys.push({
        id: pubkey,
        baseMint,
        quoteMint,
        lpMint,
        version,
        programId,

        authority,
        openOrders,
        targetOrders,
        baseVault,
        quoteVault,
        withdrawQueue,
        lpVault,
        marketVersion: serumVersion,
        marketProgramId: serumProgramId,
        marketId,
        marketAuthority,
      });
    }

    // fetch market keys
    let marketsInfo: (AccountInfo<Buffer> | null)[] = [];
    try {
      marketsInfo = await getMultipleAccountsInfo(
        connection,
        tempPoolsKeys.map(({ marketId }) => marketId),
        { batchRequest, commitment },
      );
    } catch (error) {
      if (error instanceof Error) {
        return logger.throwError("failed to get markets", Logger.errors.RPC_ERROR, {
          message: error.message,
        });
      }
    }

    if (marketsInfo.length !== tempPoolsKeys.length) {
      return logger.throwArgumentError("markets count not equal to pools", "markets.length", marketsInfo.length);
    }

    const poolsKeys: LiquidityPoolKeys[] = [];

    for (const index in marketsInfo) {
      const poolKeys = tempPoolsKeys[index];
      const marketInfo = marketsInfo[index];

      const { id, marketVersion } = poolKeys;

      if (!marketInfo) {
        return logger.throwArgumentError("empty market account info", "pool.id", id.toBase58());
      }

      const { data } = marketInfo;
      const { state: MARKET_STATE_LAYOUT } = Market.getLayouts(marketVersion);
      if (data.length !== MARKET_STATE_LAYOUT.span) {
        return logger.throwArgumentError("invalid market data length", "pool.id", id.toBase58());
      }

      const {
        baseVault: marketBaseVault,
        quoteVault: marketQuoteVault,
        bids: marketBids,
        asks: marketAsks,
        eventQueue: marketEventQueue,
      } = MARKET_STATE_LAYOUT.decode(data);

      poolsKeys.push({
        ...poolKeys,
        ...{
          marketBaseVault,
          marketQuoteVault,
          marketBids,
          marketAsks,
          marketEventQueue,
        },
      });
    }

    return poolsKeys;
  }

  static async getMultipleInfo({ connection, pools, config }: GetLiquidityMultipleInfoParams) {
    // const poolsInfo: {
    //   // same data type with layouts
    //   [key: string]: {
    //     // u64
    //     status: BN;
    //     // u8
    //     baseDecimals: number;
    //     // u8
    //     quoteDecimals: number;
    //     // u8
    //     lpDecimals: number;
    //     // u64
    //     baseReserve: BN;
    //     // u64
    //     quoteReserve: BN;
    //     // u64
    //     lpSupply: BN;
    //   };
    // } = {};

    const instructions = pools.map((pool) => this.makeSimulatePoolInfoInstruction({ poolKeys: pool }));

    const logs = await simulateMultipleInstruction(connection, instructions);
    const filteredLogs = logs.filter((log) => log && log.includes("GetPoolData"));

    const poolsInfo = filteredLogs.map((log) => {
      const json = parseSimulateLog(log, "GetPoolData");

      const status = new BN(parseSimulateValue(json, "status"));
      const baseDecimals = Number(parseSimulateValue(json, "coin_decimals"));
      const quoteDecimals = Number(parseSimulateValue(json, "pc_decimals"));
      const lpDecimals = Number(parseSimulateValue(json, "lp_decimals"));
      const baseReserve = new BN(parseSimulateValue(json, "pool_coin_amount"));
      const quoteReserve = new BN(parseSimulateValue(json, "pool_pc_amount"));
      const lpSupply = new BN(parseSimulateValue(json, "pool_lp_supply"));

      return {
        status,
        baseDecimals,
        quoteDecimals,
        lpDecimals,
        baseReserve,
        quoteReserve,
        lpSupply,
      };
    });

    // for (const log of logs) {
    //   const json = parseSimulateLog(log, "GetPoolData");

    //   const status = new BN(parseSimulateValue(json, "status"));
    //   const baseDecimals = Number(parseSimulateValue(json, "coin_decimals"));
    //   const quoteDecimals = Number(parseSimulateValue(json, "pc_decimals"));
    //   const lpDecimals = Number(parseSimulateValue(json, "lp_decimals"));
    //   const baseReserve = new BN(parseSimulateValue(json, "pool_coin_amount"));
    //   const quoteReserve = new BN(parseSimulateValue(json, "pool_pc_amount"));
    //   const lpSupply = new BN(parseSimulateValue(json, "pool_lp_supply"));
    // }

    return poolsInfo;
  }

  static getQuote({ amount, fixedSide, baseReserve, quoteReserve }: GetQuoteParams) {
    const _amount = parseBigNumberish(amount);
    const _baseReserve = parseBigNumberish(baseReserve);
    const _quoteReserve = parseBigNumberish(quoteReserve);

    if (fixedSide === "base") {
      return _amount.mul(_quoteReserve).div(_baseReserve);
    } else if (fixedSide === "quote") {
      return _amount.mul(_baseReserve).div(_quoteReserve);
    }

    return logger.throwArgumentError("invalid fixedSide", "fixedSide", fixedSide);
  }

  /**
   * Get the amount of add liquidity
   * @example
   * ```
   * Liquidity.getAmountB({
   *   // 1%
   *   slippage: new Percent(1, 100)
   * })
   * ```
   */
  static getAmountB({ amountA, fixedSide, baseReserve, quoteReserve, slippage }: GetAmountBParams) {
    const slippageAdjustedAmount = new Percent(ONE)
      .add(slippage)
      .mul(this.getQuote({ amount: amountA, fixedSide, baseReserve, quoteReserve })).quotient;

    return slippageAdjustedAmount;
  }

  /**
   * Get output amount of swap
   */
  static getAmountOut({ amountIn, baseReserve, quoteReserve, tradeSide, slippage }: GetAmountOutParams) {
    const _amountIn = parseBigNumberish(amountIn);

    const reserves = [parseBigNumberish(baseReserve), parseBigNumberish(quoteReserve)];
    if (tradeSide === "buy") {
      reserves.reverse();
    }
    const [reserveIn, reserveOut] = reserves;

    let _slippage = new Percent(ONE);
    if (slippage) {
      _slippage = _slippage.add(slippage);
    }

    const amountInWithFee = _amountIn.mul(LIQUIDITY_FEES_NUMERATOR);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(LIQUIDITY_FEES_DENOMINATOR).add(amountInWithFee);

    const amountOut = numerator.div(denominator);
    const minAmountOut = _slippage.invert().mul(amountOut).quotient;

    return { amountOut, minAmountOut };
  }

  /**
   * Get input amount of swap
   */
  static getAmountIn({ amountOut, baseReserve, quoteReserve, tradeSide, slippage }: GetAmountInParams) {
    const _amountOut = parseBigNumberish(amountOut);

    const reserves = [parseBigNumberish(baseReserve), parseBigNumberish(quoteReserve)];
    if (tradeSide === "buy") {
      reserves.reverse();
    }
    const [reserveIn, reserveOut] = reserves;

    let _slippage = new Percent(ONE);
    if (slippage) {
      _slippage = _slippage.add(slippage);
    }

    const numerator = reserveIn.mul(_amountOut).mul(LIQUIDITY_FEES_DENOMINATOR);
    const denominator = reserveOut.sub(_amountOut).mul(LIQUIDITY_FEES_NUMERATOR);

    const amountIn = numerator.div(denominator).add(ONE);
    const maxAmountIn = _slippage.mul(amountIn).quotient;

    return { amountIn, maxAmountIn };
  }
}
