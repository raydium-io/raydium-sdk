import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { LiquidityVersion } from "../../api/type";
import { createLogger } from "../../common/logger";
import {
  findProgramAddress,
  parseSimulateLogToJson,
  parseSimulateValue,
  simulateMultipleInstruction,
} from "../../common/txTool";
import { CurrencyAmount, Token, TokenAmount } from "../../module";

import { LIQUIDITY_VERSION_TO_PROGRAM_ID, LiquidityPoolStatus } from "./constant";
import { makeSimulatePoolInfoInstruction } from "./instruction";
import { LIQUIDITY_VERSION_TO_STATE_LAYOUT, LiquidityStateLayout } from "./layout";
import { getSerumAssociatedAuthority, getSerumProgramId, getSerumVersion } from "./serum";
import {
  AmountSide,
  LiquidityAssociatedPoolKeys,
  LiquidityFetchMultipleInfoParams,
  LiquidityPoolInfo,
  LiquidityPoolKeys,
} from "./type";

const logger = createLogger("Raydium.liquidity.util");
/**
 * Get currency amount side of liquidity pool
 * @param amount - the currency amount provided
 * @param poolKeys - the pool keys
 * @returns currency amount side is `base` or `quote`
 */
export function getAmountSide(amount: CurrencyAmount | TokenAmount, poolKeys: LiquidityPoolKeys): AmountSide {
  const token = amount instanceof TokenAmount ? amount.token : Token.WSOL;
  const { baseMint, quoteMint } = poolKeys;

  if (token.mint.equals(baseMint)) return "base";
  else if (token.mint.equals(quoteMint)) return "quote";
  const error = `liquidity getTokenSide - token not match with pool, params: ${JSON.stringify({
    token: token.mint,
    baseMint,
    quoteMint,
  })}`;
  console.error(error);
  throw new Error(error);
}

export function includesToken(token: Token, poolKeys: LiquidityPoolKeys): boolean {
  const { baseMint, quoteMint } = poolKeys;
  return token.mint.equals(baseMint) || token.mint.equals(quoteMint);
}

export function getPoolEnabledFeatures(poolInfo: LiquidityPoolInfo): {
  swap: boolean;
  addLiquidity: boolean;
  removeLiquidity: boolean;
} {
  const { status, startTime } = poolInfo;
  const statusEnum = status.toNumber();

  const statusMap = {
    [LiquidityPoolStatus.Uninitialized]: {
      swap: false,
      addLiquidity: false,
      removeLiquidity: false,
    },
    [LiquidityPoolStatus.Initialized]: {
      swap: true,
      addLiquidity: true,
      removeLiquidity: true,
    },
    [LiquidityPoolStatus.Disabled]: {
      swap: false,
      addLiquidity: false,
      removeLiquidity: false,
    },
    [LiquidityPoolStatus.RemoveLiquidityOnly]: {
      swap: false,
      addLiquidity: false,
      removeLiquidity: true,
    },
    [LiquidityPoolStatus.LiquidityOnly]: {
      swap: false,
      addLiquidity: true,
      removeLiquidity: true,
    },
    [LiquidityPoolStatus.OrderBook]: {
      swap: false,
      addLiquidity: true,
      removeLiquidity: true,
    },
    [LiquidityPoolStatus.Swap]: {
      swap: true,
      addLiquidity: true,
      removeLiquidity: true,
    },
    [LiquidityPoolStatus.WaitingForStart]: {
      swap: Date.now() / 1000 >= startTime.toNumber(),
      addLiquidity: true,
      removeLiquidity: true,
    },
  };

  return (
    statusMap[statusEnum] || {
      swap: false,
      addLiquidity: false,
      removeLiquidity: false,
    }
  );
}

export function getLiquidityStateLayout(version: number): LiquidityStateLayout {
  const STATE_LAYOUT = LIQUIDITY_VERSION_TO_STATE_LAYOUT[version];
  if (!STATE_LAYOUT) logger.logWithError("invalid version", "version", version);

  return STATE_LAYOUT;
}

export function getLiquidityProgramId(version: number): PublicKey {
  const programId = LIQUIDITY_VERSION_TO_PROGRAM_ID[version];
  if (!programId) logger.logWithError("invalid version", "version", version);

  return programId;
}

interface GetAssociatedParam {
  name: AssociatedName;
  programId: PublicKey;
  marketId: PublicKey;
}

type AssociatedName =
  | "amm_associated_seed"
  | "lp_mint_associated_seed"
  | "coin_vault_associated_seed"
  | "pc_vault_associated_seed"
  | "lp_mint_associated_seed"
  | "temp_lp_token_associated_seed"
  | "open_order_associated_seed"
  | "target_associated_seed"
  | "withdraw_associated_seed";

export async function getLiquidityAssociatedId({ name, programId, marketId }: GetAssociatedParam): Promise<PublicKey> {
  const { publicKey } = await findProgramAddress(
    [programId.toBuffer(), marketId.toBuffer(), Buffer.from(name, "utf-8")],
    programId,
  );
  return publicKey;
}

export async function getLiquidityAssociatedAuthority({
  programId,
}: {
  programId: PublicKey;
}): Promise<{ publicKey: PublicKey; nonce: number }> {
  return findProgramAddress([Buffer.from([97, 109, 109, 32, 97, 117, 116, 104, 111, 114, 105, 116, 121])], programId);
}

export async function getAssociatedPoolKeys({
  version,
  marketId,
  baseMint,
  quoteMint,
}: {
  version: LiquidityVersion;
  marketId: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
}): Promise<LiquidityAssociatedPoolKeys> {
  const programId = getLiquidityProgramId(version);

  const id = await getLiquidityAssociatedId({ name: "amm_associated_seed", programId, marketId });
  const lpMint = await getLiquidityAssociatedId({ name: "lp_mint_associated_seed", programId, marketId });
  const { publicKey: authority, nonce } = await getLiquidityAssociatedAuthority({ programId });
  const baseVault = await getLiquidityAssociatedId({ name: "coin_vault_associated_seed", programId, marketId });
  const quoteVault = await getLiquidityAssociatedId({ name: "pc_vault_associated_seed", programId, marketId });
  const lpVault = await getLiquidityAssociatedId({ name: "temp_lp_token_associated_seed", programId, marketId });
  const openOrders = await getLiquidityAssociatedId({ name: "open_order_associated_seed", programId, marketId });
  const targetOrders = await getLiquidityAssociatedId({ name: "target_associated_seed", programId, marketId });
  const withdrawQueue = await getLiquidityAssociatedId({ name: "withdraw_associated_seed", programId, marketId });

  const serumVersion = getSerumVersion(version);
  const serumProgramId = getSerumProgramId(serumVersion);
  const { publicKey: marketAuthority } = await getSerumAssociatedAuthority({
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

export async function makeSimulationPoolInfo({
  connection,
  pools,
}: LiquidityFetchMultipleInfoParams & { connection: Connection }): Promise<LiquidityPoolInfo[]> {
  const instructions = pools.map((pool) => makeSimulatePoolInfoInstruction(pool));
  const logs = await simulateMultipleInstruction(connection, instructions, "GetPoolData");

  return logs.map((log) => {
    const json = parseSimulateLogToJson(log, "GetPoolData");
    const status = new BN(parseSimulateValue(json, "status"));
    const baseDecimals = Number(parseSimulateValue(json, "coin_decimals"));
    const quoteDecimals = Number(parseSimulateValue(json, "pc_decimals"));
    const lpDecimals = Number(parseSimulateValue(json, "lp_decimals"));
    const baseReserve = new BN(parseSimulateValue(json, "pool_coin_amount"));
    const quoteReserve = new BN(parseSimulateValue(json, "pool_pc_amount"));
    const lpSupply = new BN(parseSimulateValue(json, "pool_lp_supply"));
    let startTime = "0";
    try {
      startTime = parseSimulateValue(json, "pool_open_time");
    } catch (error) {
      startTime = "0";
    }

    return {
      status,
      baseDecimals,
      quoteDecimals,
      lpDecimals,
      baseReserve,
      quoteReserve,
      lpSupply,
      startTime: new BN(startTime),
    };
  });
}

/**
 * Get currencies amount side of liquidity pool
 * @param amountA - the currency amount provided
 * @param amountB - the currency amount provided
 * @param poolKeys - the pool keys
 * @returns currencies amount side array
 */
export function getAmountsSide(amountA: TokenAmount, amountB: TokenAmount, poolKeys: LiquidityPoolKeys): AmountSide[] {
  return getTokensSide(amountA.token, amountB.token, poolKeys);
}

export function getTokensSide(tokenA: Token, tokenB: Token, poolKeys: LiquidityPoolKeys): AmountSide[] {
  const { baseMint, quoteMint } = poolKeys;

  const sideA = getTokenSide(tokenA, poolKeys);
  const sideB = getTokenSide(tokenB, poolKeys);

  if (sideA === sideB)
    logger.logWithError("tokens not match with pool", "params", {
      tokenA: tokenA.mint,
      tokenB: tokenB.mint,
      baseMint,
      quoteMint,
    });
  return [sideA, sideB];
}

export function getTokenSide(token: Token, poolKeys: LiquidityPoolKeys): AmountSide {
  const { baseMint, quoteMint } = poolKeys;

  if (token.mint.equals(baseMint)) return "base";
  else if (token.mint.equals(quoteMint)) return "quote";

  logger.logWithError("token not match with pool", "params", {
    token: token.mint,
    baseMint,
    quoteMint,
  });
  return "base"; // won't reach
}

export const isValidFixedSide = (val: string): boolean => val === "a" || val === "b";
