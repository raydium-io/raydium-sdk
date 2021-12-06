import BN from "bn.js";

import { AccountInfo, Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  AccountMeta, AccountMetaReadonly, findProgramAddress, getMultipleAccountsInfo,
  GetMultipleAccountsInfoConfig, Logger, parseSimulateLog, parseSimulateValue, PublicKeyIsh,
  simulateMultipleInstruction, TOKEN_PROGRAM_ID, validateAndParsePublicKey,
} from "../common";
import { BigNumberIsh, parseBigNumberIsh } from "../entity";
import { struct, u64, u8 } from "../marshmallow";
import { Market } from "../serum";
import {
  LIQUIDITY_PROGRAMID_TO_VERSION, LIQUIDITY_VERSION_TO_PROGRAMID,
  LIQUIDITY_VERSION_TO_SERUM_VERSION,
} from "./id";
import { LIQUIDITY_VERSION_TO_STATE_LAYOUT, LiquidityStateLayout } from "./layout";
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

export interface GetLiquidityMultipleInfoParams {
  connection: Connection;
  pools: LiquidityPoolKeys[];
  config?: GetMultipleAccountsInfoConfig;
}

export const LIQUIDITY_FEES_NUMERATOR = new BN(9975);
export const LIQUIDITY_FEES_DENOMINATOR = new BN(10000);

export class Liquidity {
  /* ================= static functions ================= */
  static getProgramId(version: number) {
    const programId = LIQUIDITY_VERSION_TO_PROGRAMID[version];
    if (!programId) {
      return logger.throwArgumentError("invalid version", "version", version);
    }

    return programId;
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
      const serumVersion = this.getSerumVersion({ version });
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
        tempLpVault,
        marketId,
      } = LIQUIDITY_STATE_LAYOUT.decode(data);

      // uninitialized
      if (status.isZero()) {
        continue;
      }

      const authority = await Liquidity.getAuthority({ programId });
      const marketVaultSigner = await Market.getVaultSigner({ programId: serumProgramId, marketId });

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
        tempLpVault,
        marketVersion: serumVersion,
        marketProgramId: serumProgramId,
        marketId,
        marketVaultSigner,
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
      const { state: MARKET_STATE_LAYOUT } = Market.getLayout({ version: marketVersion });
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

  static getOutputAmount(inputAmount: BigNumberIsh, inputReserve: BigNumberIsh, outputReserve: BigNumberIsh) {
    const _inputAmount = parseBigNumberIsh(inputAmount);
    const _inputReserve = parseBigNumberIsh(inputReserve);
    const _outputReserve = parseBigNumberIsh(outputReserve);

    const inputAmountWithFee = _inputAmount.mul(LIQUIDITY_FEES_NUMERATOR);
    const numerator = inputAmountWithFee.mul(_outputReserve);
    const denominator = _inputReserve.mul(LIQUIDITY_FEES_DENOMINATOR).add(inputAmountWithFee);

    const outputAmount = numerator.div(denominator);

    return outputAmount;
  }

  // static getInputAmount() {}
}
