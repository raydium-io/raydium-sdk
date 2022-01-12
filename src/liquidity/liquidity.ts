import { AccountInfo, Connection, PublicKey, Signer, Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, getMultipleAccountsInfo, GetMultipleAccountsInfoConfig, Logger,
  parseSimulateLogToJson, parseSimulateValue, simulateMultipleInstruction, SYSTEM_PROGRAM_ID, SYSVAR_RENT_PUBKEY,
  TOKEN_PROGRAM_ID, XOR,
} from "../common";
import {
  BigNumberish, Currency, CurrencyAmount, divCeil, ONE, parseBigNumberish, Percent, Token, TokenAmount,
} from "../entity";
import { struct, u64, u8 } from "../marshmallow";
import { Market } from "../serum";
import { Spl } from "../spl";

import {
  LIQUIDITY_PROGRAMID_TO_VERSION, LIQUIDITY_VERSION_TO_PROGRAMID, LIQUIDITY_VERSION_TO_SERUM_VERSION,
} from "./id";
import { LIQUIDITY_VERSION_TO_STATE_LAYOUT, LiquidityStateLayout } from "./layout";
import { LiquidityPoolJsonInfo } from "./type";

const logger = Logger.from("Liquidity");

// buy: quote => base
// sell: base => quote
export type TradeSide = "buy" | "sell";

export type SwapSide = "input" | "output";
export type LiquiditySide = "a" | "b";
// for inner instruction
export type AmountSide = "base" | "quote";

/* ================= pool keys ================= */
export type LiquidityPoolKeysV4 = {
  [T in keyof LiquidityPoolJsonInfo]: LiquidityPoolJsonInfo[T] extends string ? PublicKey : LiquidityPoolJsonInfo[T];
};

/**
 * Full liquidity pool keys that build transaction need
 */
export type LiquidityPoolKeys = LiquidityPoolKeysV4;

export interface AssociatedPoolKeysV4
  extends Omit<
    LiquidityPoolKeysV4,
    "marketBaseVault" | "marketQuoteVault" | "marketBids" | "marketAsks" | "marketEventQueue"
  > {
  nonce: number;
}

/**
 * Associated liquidity pool keys
 * @remarks
 * without partial markets keys
 */
export type AssociatedPoolKeys = AssociatedPoolKeysV4;

/* ================= pool info ================= */
/**
 * Liquidity pool info
 * @remarks
 * same data type with layouts
 */
export interface LiquidityPoolInfo {
  status: BN;
  baseDecimals: number;
  quoteDecimals: number;
  lpDecimals: number;
  baseReserve: BN;
  quoteReserve: BN;
  lpSupply: BN;
}

/* ================= user keys ================= */
/**
 * Full user keys that build transaction need
 */
export interface LiquidityUserKeys {
  baseTokenAccount: PublicKey;
  quoteTokenAccount: PublicKey;
  lpTokenAccount: PublicKey;
  owner: PublicKey;
}

// liquidity class
// export interface LiquidityLoadParams {
//   connection: Connection;
//   poolKeys: LiquidityPoolKeys;
//   poolInfo?: LiquidityPoolInfo;
// }

// export type LiquidityConstructParams = Required<LiquidityLoadParams>;

/* ================= make instruction and transaction ================= */
export interface AddLiquidityInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: LiquidityUserKeys;
  baseAmountIn: BigNumberish;
  quoteAmountIn: BigNumberish;
  fixedSide: AmountSide;
}

/**
 * Add liquidity instruction params
 */
export type AddLiquidityInstructionParams = AddLiquidityInstructionParamsV4;

export interface makeAddLiquidityTransactionParams
  extends Omit<AddLiquidityInstructionParams, "userKeys" | "baseAmountIn" | "quoteAmountIn" | "fixedSide"> {
  connection: Connection;
  userKeys: {
    tokenAccountA?: PublicKey;
    tokenAccountB?: PublicKey;
    lpTokenAccount?: PublicKey;
    owner: PublicKey;
    payer?: PublicKey;
  };
  currencyAmountInA: CurrencyAmount | TokenAmount;
  currencyAmountInB: CurrencyAmount | TokenAmount;
  fixedSide: LiquiditySide;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}

export interface RemoveLiquidityInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: LiquidityUserKeys;
  amountIn: BigNumberish;
}

/**
 * Remove liquidity instruction params
 */
export type RemoveLiquidityInstructionParams = RemoveLiquidityInstructionParamsV4;

export interface makeRemoveLiquidityTransactionParams
  extends Omit<RemoveLiquidityInstructionParamsV4, "userKeys" | "amountIn"> {
  connection: Connection;
  userKeys: {
    lpTokenAccount: PublicKey;
    baseTokenAccount?: PublicKey;
    quoteTokenAccount?: PublicKey;
    owner: PublicKey;
    payer?: PublicKey;
  };
  tokenAmountIn: TokenAmount;
  config?: {
    bypassAssociatedCheck?: boolean;
  };
}

export interface SwapFixedInInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: Omit<LiquidityUserKeys, "lpTokenAccount">;
  amountIn: BigNumberish;
  // minimum amount out
  minAmountOut: BigNumberish;
  tradeSide: TradeSide;
}

export interface SwapFixedOutInstructionParamsV4 {
  poolKeys: LiquidityPoolKeys;
  userKeys: Omit<LiquidityUserKeys, "lpTokenAccount">;
  // maximum amount in
  maxAmountIn: BigNumberish;
  amountOut: BigNumberish;
  tradeSide: TradeSide;
}

/**
 * Swap instruction params
 */
export type SwapInstructionParams = { fixedSide: AmountSide } & XOR<
  SwapFixedInInstructionParamsV4,
  SwapFixedOutInstructionParamsV4
>;

export interface CreatePoolInstructionParamsV4 {
  poolKeys: AssociatedPoolKeysV4;
  userKeys: {
    payer: PublicKey;
  };
}

/**
 * Create pool instruction params
 */
export type CreatePoolInstructionParams = CreatePoolInstructionParamsV4;

export interface InitPoolInstructionParamsV4 {
  poolKeys: AssociatedPoolKeysV4;
  userKeys: {
    lpTokenAccount: PublicKey;
    payer: PublicKey;
  };
}

/**
 * Init pool instruction params
 */
export type InitPoolInstructionParams = InitPoolInstructionParamsV4;

/* ================= fetch data ================= */
/**
 * Fetch liquidity pool info params
 */
export interface FetchLiquidityInfoParams {
  connection: Connection;
  poolKeys: LiquidityPoolKeys;
}

/**
 * Fetch liquidity multiple pool info params
 */
export interface FetchLiquidityMultipleInfoParams {
  connection: Connection;
  pools: LiquidityPoolKeys[];
  config?: GetMultipleAccountsInfoConfig;
}

/* ================= compute data ================= */
export interface ComputeAnotherCurrencyAmountParams {
  poolKeys: LiquidityPoolKeys;
  poolInfo: LiquidityPoolInfo;
  currencyAmount: CurrencyAmount | TokenAmount;
  anotherCurrency: Currency | Token;
  slippage: Percent;
}

export const LIQUIDITY_FEES_NUMERATOR = new BN(9975);
export const LIQUIDITY_FEES_DENOMINATOR = new BN(10000);

export interface ComputeCurrencyAmountOutParams {
  poolKeys: LiquidityPoolKeys;
  poolInfo: LiquidityPoolInfo;
  currencyAmountIn: CurrencyAmount | TokenAmount;
  currencyOut: Currency | Token;
  slippage: Percent;
}

export interface ComputeCurrencyAmountInParams
  extends Omit<ComputeCurrencyAmountOutParams, "currencyAmountIn" | "currencyOut"> {
  currencyAmountOut: CurrencyAmount | TokenAmount;
  currencyIn: Currency | Token;
}

export class Liquidity {
  // public connection: Connection;
  // public poolKeys: LiquidityPoolKeys;
  // public poolInfo: LiquidityPoolInfo;

  // constructor({ connection, poolKeys, poolInfo }: LiquidityConstructParams) {
  //   this.connection = connection;
  //   this.poolKeys = poolKeys;
  //   this.poolInfo = poolInfo;
  // }

  // static async load({ connection, poolKeys, poolInfo }: LiquidityLoadParams) {
  //   const _poolInfo = poolInfo || (await this.fetchInfo({ connection, poolKeys }));

  //   return new Liquidity({ connection, poolKeys, poolInfo: _poolInfo });
  // }

  /* ================= get version and program id ================= */
  static getProgramId(version: number) {
    const programId = LIQUIDITY_VERSION_TO_PROGRAMID[version];
    logger.assertArgument(!!programId, "invalid version", "version", version);

    return programId;
  }

  static getVersion(programId: PublicKey) {
    const programIdString = programId.toBase58();

    const version = LIQUIDITY_PROGRAMID_TO_VERSION[programIdString];
    logger.assertArgument(!!version, "invalid program id", "programId", programIdString);

    return version;
  }

  static getSerumVersion(version: number) {
    const serumVersion = LIQUIDITY_VERSION_TO_SERUM_VERSION[version];
    logger.assertArgument(!!serumVersion, "invalid version", "version", version);

    return serumVersion;
  }

  /* ================= get layout ================= */
  static getStateLayout(version: number) {
    const STATE_LAYOUT = LIQUIDITY_VERSION_TO_STATE_LAYOUT[version];
    logger.assertArgument(!!STATE_LAYOUT, "invalid version", "version", version);

    return STATE_LAYOUT;
  }

  static getLayouts(version: number) {
    return { state: this.getStateLayout(version) };
  }

  /* ================= get key ================= */
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
    const { publicKey: marketAuthority } = await Market.getAssociatedAuthority({
      programId: serumProgramId,
      marketId,
    });

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
      marketAuthority,
    };
  }

  /* ================= make instruction and transaction ================= */
  static makeAddLiquidityInstruction(params: AddLiquidityInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 4) {
      return this.makeAddLiquidityInstructionV4(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static async makeAddLiquidityTransaction(params: makeAddLiquidityTransactionParams) {
    const { connection, poolKeys, userKeys, currencyAmountInA, currencyAmountInB, fixedSide, config } = params;
    const { baseMint, quoteMint, lpMint } = poolKeys;
    const { tokenAccountA, tokenAccountB, lpTokenAccount, owner, payer } = userKeys;

    logger.assertArgument(
      !currencyAmountInA.isZero && !currencyAmountInB.isZero,
      "amounts must greater than zero",
      "tokenAmount",
      {
        currencyAmountInA: currencyAmountInA.toExact(),
        currencyAmountInB: currencyAmountInB.toExact(),
      },
    );
    logger.assertArgument(!!tokenAccountA || !!tokenAccountB, "miss tokenAccounts", "tokenAccounts", {
      tokenAccountA,
      tokenAccountB,
    });

    const { bypassAssociatedCheck } = {
      // default
      ...{
        bypassAssociatedCheck: false,
      },
      // custom
      ...config,
    };

    const _payer = payer || owner;

    // handle currency a & b (convert SOL to WSOL)
    const tokenA = currencyAmountInA instanceof TokenAmount ? currencyAmountInA.token : Token.WSOL;
    const tokenB = currencyAmountInB instanceof TokenAmount ? currencyAmountInB.token : Token.WSOL;

    const tokens = [tokenA, tokenB];
    const tokenAccounts = [tokenAccountA, tokenAccountB];
    const amounts = [currencyAmountInA.raw, currencyAmountInB.raw];

    // handle amount a & b and direction
    const [sideA] = this.getAmountsSide(currencyAmountInA, currencyAmountInB, poolKeys);
    let _fixedSide: AmountSide = "base";
    if (sideA === "quote") {
      // reverse
      tokens.reverse();
      tokenAccounts.reverse();
      amounts.reverse();

      if (fixedSide === "a") {
        _fixedSide = "quote";
      }
    } else if (fixedSide === "b") {
      _fixedSide = "quote";
    }

    const [baseToken, quoteToken] = tokens;
    const [baseTokenAccount, quoteTokenAccount] = tokenAccounts;
    const [baseAmount, quoteAmount] = amounts;

    let _baseTokenAccount = await Spl.getAssociatedTokenAccount({ mint: baseMint, owner });
    let _quoteTokenAccount = await Spl.getAssociatedTokenAccount({ mint: quoteMint, owner });
    let _lpTokenAccount = await Spl.getAssociatedTokenAccount({ mint: lpMint, owner });

    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];
    const signers: Signer[] = [];

    // handle base token account
    if (baseToken.equals(Token.WSOL)) {
      const newBaseTokenAccount = await Spl.insertCreateWrappedNativeAccountInstructions({
        connection,
        owner,
        payer: _payer,
        instructions: frontInstructions,
        signers,
        amount: baseAmount,
      });
      endInstructions.push(
        Spl.makeCloseAccountInstruction({ tokenAccount: newBaseTokenAccount, owner, payer: _payer }),
      );
      _baseTokenAccount = newBaseTokenAccount;
    } else if (!baseTokenAccount) {
      frontInstructions.push(
        Spl.makeCreateAssociatedTokenAccountInstruction({
          mint: baseMint,
          associatedAccount: _baseTokenAccount,
          owner,
          payer: owner,
        }),
      );
    } else {
      _baseTokenAccount = baseTokenAccount;
    }

    // handle quote token account
    if (quoteToken.equals(Token.WSOL)) {
      const newQuoteTokenAccount = await Spl.insertCreateWrappedNativeAccountInstructions({
        connection,
        owner,
        payer: _payer,
        instructions: frontInstructions,
        signers,
        amount: quoteAmount,
      });
      endInstructions.push(
        Spl.makeCloseAccountInstruction({ tokenAccount: newQuoteTokenAccount, owner, payer: _payer }),
      );
      _quoteTokenAccount = newQuoteTokenAccount;
    } else if (!quoteTokenAccount) {
      frontInstructions.push(
        Spl.makeCreateAssociatedTokenAccountInstruction({
          mint: quoteMint,
          associatedAccount: _quoteTokenAccount,
          owner,
          payer: owner,
        }),
      );
    } else {
      _quoteTokenAccount = quoteTokenAccount;
    }

    // handle lp token account
    if (!lpTokenAccount || (!_lpTokenAccount.equals(lpTokenAccount) && !bypassAssociatedCheck)) {
      frontInstructions.push(
        Spl.makeCreateAssociatedTokenAccountInstruction({
          mint: lpMint,
          associatedAccount: _lpTokenAccount,
          owner,
          payer: owner,
        }),
      );
    } else {
      _lpTokenAccount = lpTokenAccount;
    }

    frontInstructions.push(
      this.makeAddLiquidityInstruction({
        poolKeys,
        userKeys: {
          baseTokenAccount: _baseTokenAccount,
          quoteTokenAccount: _quoteTokenAccount,
          lpTokenAccount: _lpTokenAccount,
          owner,
        },
        baseAmountIn: baseAmount,
        quoteAmountIn: quoteAmount,
        fixedSide: _fixedSide,
      }),
    );

    const transaction = new Transaction();
    for (const instruction of [...frontInstructions, ...endInstructions]) {
      transaction.add(instruction);
    }

    return { transaction, signers };
  }

  static makeAddLiquidityInstructionV4({
    poolKeys,
    userKeys,
    baseAmountIn,
    quoteAmountIn,
    fixedSide,
  }: AddLiquidityInstructionParamsV4) {
    const LAYOUT = struct([u8("instruction"), u64("baseAmountIn"), u64("quoteAmountIn"), u64("fixedSide")]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 3,
        baseAmountIn: parseBigNumberish(baseAmountIn),
        quoteAmountIn: parseBigNumberish(quoteAmountIn),
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

  static makeRemoveLiquidityInstruction(params: RemoveLiquidityInstructionParams) {
    const { poolKeys } = params;
    const { version } = poolKeys;

    if (version === 4) {
      return this.makeRemoveLiquidityInstructionV4(params);
    }

    return logger.throwArgumentError("invalid version", "poolKeys.version", version);
  }

  static async makeRemoveLiquidityTransaction(params: makeRemoveLiquidityTransactionParams) {
    const { connection, poolKeys, userKeys, tokenAmountIn, config } = params;
    const { baseMint, quoteMint } = poolKeys;
    const { lpTokenAccount, baseTokenAccount, quoteTokenAccount, owner, payer } = userKeys;

    logger.assertArgument(
      !tokenAmountIn.isZero,
      "amounts must greater than zero",
      "tokenAmountIn",
      tokenAmountIn.toExact(),
    );
    logger.assertArgument(!!lpTokenAccount, "miss lpTokenAccount", "lpTokenAccount", lpTokenAccount);

    const { bypassAssociatedCheck } = {
      // default
      ...{
        bypassAssociatedCheck: false,
      },
      // custom
      ...config,
    };

    const _payer = payer || owner;

    const _lpTokenAccount = lpTokenAccount;
    let _baseTokenAccount = await Spl.getAssociatedTokenAccount({ mint: baseMint, owner });
    let _quoteTokenAccount = await Spl.getAssociatedTokenAccount({ mint: quoteMint, owner });

    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];
    const signers: Signer[] = [];

    // handle base token account
    if (Token.WSOL.mint.equals(baseMint)) {
      const newBaseTokenAccount = await Spl.insertCreateWrappedNativeAccountInstructions({
        connection,
        owner,
        payer: _payer,
        instructions: frontInstructions,
        signers,
        amount: 0,
      });
      endInstructions.push(
        Spl.makeCloseAccountInstruction({ tokenAccount: newBaseTokenAccount, owner, payer: _payer }),
      );
      _baseTokenAccount = newBaseTokenAccount;
    } else if (!baseTokenAccount || (!_baseTokenAccount.equals(baseTokenAccount) && !bypassAssociatedCheck)) {
      frontInstructions.push(
        Spl.makeCreateAssociatedTokenAccountInstruction({
          mint: baseMint,
          associatedAccount: _baseTokenAccount,
          owner,
          payer: owner,
        }),
      );
    } else {
      _baseTokenAccount = baseTokenAccount;
    }

    // handle quote token account
    if (Token.WSOL.mint.equals(quoteMint)) {
      const newQuoteTokenAccount = await Spl.insertCreateWrappedNativeAccountInstructions({
        connection,
        owner,
        payer: _payer,
        instructions: frontInstructions,
        signers,
        amount: 0,
      });
      endInstructions.push(
        Spl.makeCloseAccountInstruction({ tokenAccount: newQuoteTokenAccount, owner, payer: _payer }),
      );
      _quoteTokenAccount = newQuoteTokenAccount;
    } else if (!quoteTokenAccount || (!_quoteTokenAccount.equals(quoteTokenAccount) && !bypassAssociatedCheck)) {
      frontInstructions.push(
        Spl.makeCreateAssociatedTokenAccountInstruction({
          mint: quoteMint,
          associatedAccount: _quoteTokenAccount,
          owner,
          payer: owner,
        }),
      );
    } else {
      _quoteTokenAccount = quoteTokenAccount;
    }

    frontInstructions.push(
      this.makeRemoveLiquidityInstruction({
        poolKeys,
        userKeys: {
          lpTokenAccount: _lpTokenAccount,
          baseTokenAccount: _baseTokenAccount,
          quoteTokenAccount: _quoteTokenAccount,
          owner,
        },
        amountIn: tokenAmountIn.raw,
      }),
    );

    const transaction = new Transaction();
    for (const instruction of [...frontInstructions, ...endInstructions]) {
      transaction.add(instruction);
    }

    return { transaction, signers };
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

  static makeSwapInstruction(params: SwapInstructionParams) {
    const { poolKeys, userKeys, amountIn, minAmountOut, maxAmountIn, amountOut, tradeSide, fixedSide } = params;
    const { version } = poolKeys;

    if (version === 4) {
      if (
        ((tradeSide === "buy" && fixedSide === "quote") || (tradeSide === "sell" && fixedSide === "base")) &&
        amountIn &&
        minAmountOut
      ) {
        return this.makeSwapFixedInInstructionV4({ poolKeys, userKeys, amountIn, minAmountOut, tradeSide });
      } else if (
        ((tradeSide === "buy" && fixedSide === "base") || (tradeSide === "sell" && fixedSide === "quote")) &&
        maxAmountIn &&
        amountOut
      ) {
        return this.makeSwapFixedOutInstructionV4({ poolKeys, userKeys, maxAmountIn, amountOut, tradeSide });
      } else {
        logger.throwArgumentError("invalid params", "params", params);
      }
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

  /* ================= fetch data ================= */
  /**
   * Fetch all pools keys from on-chain data
   */
  static async fetchAllPoolKeys(
    connection: Connection,
    config?: GetMultipleAccountsInfoConfig,
  ): Promise<LiquidityPoolKeys[]> {
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
        return logger.throwError("failed to fetch all liquidity pools", Logger.errors.RPC_ERROR, {
          message: error.message,
        });
      }
    }

    const flatPoolsAccountInfo = poolsAccountInfo.flat();
    // temp pool keys without market keys
    const tempPoolsKeys: Omit<AssociatedPoolKeys, "nonce">[] = [];

    for (const {
      pubkey,
      account: accountInfo,
      version,
      programId,
      serumVersion,
      serumProgramId,
      stateLayout: LIQUIDITY_STATE_LAYOUT,
    } of flatPoolsAccountInfo) {
      logger.assertArgument(!!accountInfo, "empty state account info", "pool.id", pubkey.toBase58());

      const { data } = accountInfo;
      logger.assertArgument(
        data.length === LIQUIDITY_STATE_LAYOUT.span,
        "invalid state data length",
        "pool.id",
        pubkey.toBase58(),
      );

      const {
        status,
        nonce,
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

      const associatedPoolKeys = await Liquidity.getAssociatedPoolKeys({
        version,
        baseMint,
        quoteMint,
        marketId,
      });
      // double check keys with on-chain data
      // logger.assert(Number(nonce) === associatedPoolKeys.nonce, "invalid nonce");

      tempPoolsKeys.push({
        id: pubkey,
        baseMint,
        quoteMint,
        lpMint,
        version,
        programId,

        authority: associatedPoolKeys.authority,
        openOrders,
        targetOrders,
        baseVault,
        quoteVault,
        withdrawQueue,
        lpVault,
        marketVersion: serumVersion,
        marketProgramId: serumProgramId,
        marketId,
        marketAuthority: associatedPoolKeys.marketAuthority,
      });
    }

    // fetch market keys
    let marketsInfo: (AccountInfo<Buffer> | null)[] = [];
    try {
      marketsInfo = await getMultipleAccountsInfo(
        connection,
        tempPoolsKeys.map(({ marketId }) => marketId),
        config,
      );
    } catch (error) {
      if (error instanceof Error) {
        return logger.throwError("failed to fetch markets", Logger.errors.RPC_ERROR, {
          message: error.message,
        });
      }
    }

    logger.assertArgument(
      marketsInfo.length === tempPoolsKeys.length,
      "markets count not equal to pools",
      "markets.length",
      marketsInfo.length,
    );

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
      logger.assertArgument(
        data.length === MARKET_STATE_LAYOUT.span,
        "invalid market data length",
        "pool.id",
        id.toBase58(),
      );

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

  /**
   * Fetch liquidity pool's info
   */
  static async fetchInfo({ connection, poolKeys }: FetchLiquidityInfoParams) {
    const info = await this.fetchMultipleInfo({ connection, pools: [poolKeys] });

    logger.assertArgument(
      info.length === 1,
      `fetchInfo failed, ${info.length} pools found`,
      "poolKeys.id",
      poolKeys.id.toBase58(),
    );

    return info[0];
  }

  /**
   * Fetch multiple info of liquidity pools
   */
  static async fetchMultipleInfo({
    connection,
    pools,
    config,
  }: FetchLiquidityMultipleInfoParams): Promise<LiquidityPoolInfo[]> {
    const instructions = pools.map((pool) => this.makeSimulatePoolInfoInstruction({ poolKeys: pool }));

    const logs = await simulateMultipleInstruction(connection, instructions, "GetPoolData");

    const poolsInfo = logs.map((log) => {
      const json = parseSimulateLogToJson(log, "GetPoolData");

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

    return poolsInfo;
  }

  /* ================= compute data ================= */
  static getTokenSide(token: Token, poolKeys: LiquidityPoolKeys): AmountSide {
    const { baseMint, quoteMint } = poolKeys;

    if (token.mint.equals(baseMint)) return "base";
    else if (token.mint.equals(quoteMint)) return "quote";
    else
      return logger.throwArgumentError("token not match with pool", "params", {
        token: token.mint.toBase58(),
        baseMint: baseMint.toBase58(),
        quoteMint: quoteMint.toBase58(),
      });
  }

  static getTokensSide(tokenA: Token, tokenB: Token, poolKeys: LiquidityPoolKeys): AmountSide[] {
    const { baseMint, quoteMint } = poolKeys;

    const sideA = this.getTokenSide(tokenA, poolKeys);
    const sideB = this.getTokenSide(tokenB, poolKeys);

    logger.assertArgument(sideA !== sideB, "tokens not match with pool", "params", {
      tokenA: tokenA.mint.toBase58(),
      tokenB: tokenB.mint.toBase58(),
      baseMint: baseMint.toBase58(),
      quoteMint: quoteMint.toBase58(),
    });
    return [sideA, sideB];
  }

  static getAmountSide(amount: CurrencyAmount | TokenAmount, poolKeys: LiquidityPoolKeys): AmountSide {
    const token = amount instanceof TokenAmount ? amount.token : Token.WSOL;

    return this.getTokenSide(token, poolKeys);
  }

  static getAmountsSide(
    amountA: CurrencyAmount | TokenAmount,
    amountB: CurrencyAmount | TokenAmount,
    poolKeys: LiquidityPoolKeys,
  ): AmountSide[] {
    const tokenA = amountA instanceof TokenAmount ? amountA.token : Token.WSOL;
    const tokenB = amountB instanceof TokenAmount ? amountB.token : Token.WSOL;

    return this.getTokensSide(tokenA, tokenB, poolKeys);
  }

  /**
   * Compute the another currency amount of add liquidity
   *
   * @returns
   * anotherCurrencyAmount - currency amount without slippage
   * @returns
   * maxAnotherCurrencyAmount - currency amount with slippage
   *
   * @returns {@link CurrencyAmount}
   *
   * @example
   * ```
   * Liquidity.computeAnotherCurrencyAmount({
   *   // 1%
   *   slippage: new Percent(1, 100)
   * })
   * ```
   */
  static computeAnotherCurrencyAmount({
    poolKeys,
    poolInfo,
    currencyAmount,
    anotherCurrency,
    slippage,
  }: ComputeAnotherCurrencyAmountParams):
    | { anotherCurrencyAmount: CurrencyAmount; maxAnotherCurrencyAmount: CurrencyAmount }
    | { anotherCurrencyAmount: TokenAmount; maxAnotherCurrencyAmount: TokenAmount } {
    const { baseReserve, quoteReserve } = poolInfo;

    // input is fixed
    const input = this.getAmountSide(currencyAmount, poolKeys);

    const _slippage = new Percent(ONE).add(slippage);

    // round up
    const amount =
      input === "base"
        ? divCeil(currencyAmount.raw.mul(quoteReserve), baseReserve)
        : divCeil(currencyAmount.raw.mul(baseReserve), quoteReserve);
    const slippageAdjustedAmount = _slippage.mul(amount).quotient;

    if (anotherCurrency instanceof Token) {
      return {
        anotherCurrencyAmount: new TokenAmount(anotherCurrency, amount),
        maxAnotherCurrencyAmount: new TokenAmount(anotherCurrency, slippageAdjustedAmount),
      };
    }

    return {
      anotherCurrencyAmount: new CurrencyAmount(anotherCurrency, amount),
      maxAnotherCurrencyAmount: new CurrencyAmount(anotherCurrency, slippageAdjustedAmount),
    };
  }

  /**
   * Compute output currency amount of swap
   *
   * @returns
   * amountOut - currency amount without slippage
   * @returns
   * minAmountOut - currency amount with slippage
   */
  static computeCurrencyAmountOut = ({
    poolKeys,
    poolInfo,
    currencyAmountIn,
    currencyOut,
    slippage,
  }: ComputeCurrencyAmountOutParams):
    | { amountOut: CurrencyAmount; minAmountOut: CurrencyAmount }
    | { amountOut: TokenAmount; minAmountOut: TokenAmount } => {
    const { baseReserve, quoteReserve } = poolInfo;

    const reserves = [parseBigNumberish(baseReserve), parseBigNumberish(quoteReserve)];

    // input is fixed
    const input = this.getAmountSide(currencyAmountIn, poolKeys);
    if (input === "quote") {
      reserves.reverse();
    }

    const [reserveIn, reserveOut] = reserves;

    const _slippage = new Percent(ONE).add(slippage);

    const amountInWithFee = currencyAmountIn.raw.mul(LIQUIDITY_FEES_NUMERATOR);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(LIQUIDITY_FEES_DENOMINATOR).add(amountInWithFee);

    const amountOut = numerator.div(denominator);
    const minAmountOut = _slippage.invert().mul(amountOut).quotient;

    if (currencyOut instanceof Token) {
      return {
        amountOut: new TokenAmount(currencyOut, amountOut),
        minAmountOut: new TokenAmount(currencyOut, minAmountOut),
      };
    }

    return {
      amountOut: new CurrencyAmount(currencyOut, amountOut),
      minAmountOut: new CurrencyAmount(currencyOut, minAmountOut),
    };
  };

  /**
   * Compute input currency amount of swap
   *
   * @returns
   * amountIn - currency amount without slippage
   * @returns
   * maxAmountIn - currency amount with slippage
   */
  static computeCurrencyAmountIn({
    poolKeys,
    poolInfo,
    currencyAmountOut,
    currencyIn,
    slippage,
  }: ComputeCurrencyAmountInParams):
    | { amountIn: CurrencyAmount; maxAmountIn: CurrencyAmount }
    | { amountIn: TokenAmount; maxAmountIn: TokenAmount } {
    const { baseReserve, quoteReserve } = poolInfo;

    const reserves = [parseBigNumberish(baseReserve), parseBigNumberish(quoteReserve)];

    // output is fixed
    const output = this.getAmountSide(currencyAmountOut, poolKeys);
    if (output === "base") {
      reserves.reverse();
    }

    const [reserveIn, reserveOut] = reserves;

    const _slippage = new Percent(ONE).add(slippage);

    const numerator = reserveIn.mul(currencyAmountOut.raw).mul(LIQUIDITY_FEES_DENOMINATOR);
    const denominator = reserveOut.sub(currencyAmountOut.raw).mul(LIQUIDITY_FEES_NUMERATOR);

    const amountIn = numerator.div(denominator).add(ONE);
    const maxAmountIn = _slippage.mul(amountIn).quotient;

    if (currencyIn instanceof Token) {
      return {
        amountIn: new TokenAmount(currencyIn, amountIn),
        maxAmountIn: new TokenAmount(currencyIn, maxAmountIn),
      };
    }

    return {
      amountIn: new CurrencyAmount(currencyIn, amountIn),
      maxAmountIn: new CurrencyAmount(currencyIn, maxAmountIn),
    };
  }
}
