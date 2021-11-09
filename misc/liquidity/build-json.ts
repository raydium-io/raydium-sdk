import chalk from "chalk";
import consola from "consola";
import dotenv from "dotenv";

import { Connection, PublicKey } from "@solana/web3.js";
import { getMultipleAccountsInfo } from "../../src/common";
import {
  Liquidity, LIQUIDITY_PROGRAM_ID_V4, LIQUIDITY_STATE_LAYOUT_V4, LiquidityPoolBaseInfo,
  LiquidityPoolJsonInfo, LiquidityVersion, MAINNET_LIQUIDITY_POOLS,
} from "../../src/liquidity";
import { Market } from "../../src/serum";
import { getTimestamp, mkdirIfNotExists, writeJsonFile } from "../util";

dotenv.config();

interface UnOfficialLiquidityPoolBaseInfo {
  id: string;
  lp: { version: LiquidityVersion };
}

async function generateLiquidityPoolsInfo<T extends boolean>(
  connection: Connection,
  pools: LiquidityPoolBaseInfo[] | UnOfficialLiquidityPoolBaseInfo[],
  official: T | boolean = true,
) {
  const ids = pools.map((pool) => {
    // check liquidity pool match lp token
    if (official && !pool.lp) {
      consola.error(`[Liquidity ${pool.id}] not match LP token`);
      process.exit(1);
    }
    return new PublicKey(pool.id);
  });

  const liquidityPools: Omit<LiquidityPoolJsonInfo, "marketBaseVault" | "marketQuoteVault">[] = [];

  // fetch liquidity pools
  const accountsInfo = await getMultipleAccountsInfo(connection, ids);
  for (const index in accountsInfo) {
    const pool = pools[index];
    const accountInfo = accountsInfo[index];

    if (!accountInfo) {
      consola.error(`[Liquidity ${pool.id}] state null account info`);
      process.exit(1);
    }

    const { data } = accountInfo;
    const { version } = pool.lp;

    const programId = Liquidity.getProgramId(version);
    const serumVersion = Liquidity.getSerumVersion({ version });
    const serumProgramId = Market.getProgramId(serumVersion);

    const LIQUIDITY_STATE_LAYOUT = Liquidity.getStateLayout(version);

    if (data.length !== LIQUIDITY_STATE_LAYOUT.span) {
      consola.error(
        `[Liquidity ${pool.id}] state invalid data length: ${chalk.green(LIQUIDITY_STATE_LAYOUT.span)} => ${chalk.red(
          data.length,
        )}`,
      );
      process.exit(1);
    }

    const authority = await Liquidity.getAuthority({ programId });

    const {
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

    // double check lp mint
    if (official) {
      if (lpMint.toBase58() !== (pool as LiquidityPoolBaseInfo).lp.mint) {
        consola.error(
          `[Liquidity ${pool.id}] state invalid lp mint: ${chalk.red(lpMint.toBase58())} <=> ${chalk.red(
            (pool as LiquidityPoolBaseInfo).lp.mint,
          )}`,
        );
        process.exit(1);
      }
    }

    const marketVaultSigner = await Market.getVaultSigner({ programId: serumProgramId, marketId });

    liquidityPools[index] = {
      ...liquidityPools[index],
      ...{
        id: pool.id,
        baseMint: baseMint.toBase58(),
        quoteMint: quoteMint.toBase58(),
        lpMint: lpMint.toBase58(),
        version,
        programId: programId.toBase58(),

        authority: authority.toBase58(),
        openOrders: openOrders.toBase58(),
        targetOrders: targetOrders.toBase58(),
        baseVault: baseVault.toBase58(),
        quoteVault: quoteVault.toBase58(),
        withdrawQueue: withdrawQueue.toBase58(),
        tempLpVault: tempLpVault.toBase58(),
        marketVersion: serumVersion,
        marketProgramId: serumProgramId.toBase58(),
        marketId: marketId.toBase58(),
        marketVaultSigner: marketVaultSigner.toBase58(),
      },
    };
  }

  // fetch market
  const marketIds = liquidityPools.map((pool) => {
    return new PublicKey(pool.marketId);
  });
  const marketsInfo = await getMultipleAccountsInfo(connection, marketIds);
  for (const index in marketsInfo) {
    const pool = liquidityPools[index];
    const marketInfo = marketsInfo[index];

    const { marketVersion, marketId } = pool;

    if (!marketInfo) {
      consola.error(`[Market ${marketId}] [Liquidity ${pool.id}] market null account info`);
      process.exit(1);
    }

    const { data } = marketInfo;

    const { state: MARKET_STATE_LAYOUT } = Market.getLayout({ version: marketVersion });

    if (data.length !== MARKET_STATE_LAYOUT.span) {
      consola.error(
        `[Market ${marketId}] [Liquidity: ${pool.id}] invalid data length: ${chalk.green(
          MARKET_STATE_LAYOUT.span,
        )} => ${chalk.red(data.length)}`,
      );
      process.exit(1);
    }

    const {
      baseVault: marketBaseVault,
      quoteVault: marketQuoteVault,
      bids: marketBids,
      asks: marketAsks,
      eventQueue: marketEventQueue,
    } = MARKET_STATE_LAYOUT.decode(data);

    liquidityPools[index] = {
      ...liquidityPools[index],
      ...{
        marketBaseVault: marketBaseVault.toBase58(),
        marketQuoteVault: marketQuoteVault.toBase58(),
        marketBids: marketBids.toBase58(),
        marketAsks: marketAsks.toBase58(),
        marketEventQueue: marketEventQueue.toBase58(),
      },
    };
  }

  return liquidityPools;
}

async function buildLiquidityPools(connection: Connection) {
  const liquidityDir = "./dist/liquidity";

  mkdirIfNotExists("./dist");
  mkdirIfNotExists(liquidityDir);

  // raydium v4
  const programId = new PublicKey(LIQUIDITY_PROGRAM_ID_V4);
  const unOfficialPools: UnOfficialLiquidityPoolBaseInfo[] = (
    await connection.getProgramAccounts(programId, {
      filters: [{ dataSize: LIQUIDITY_STATE_LAYOUT_V4.span }],
    })
  )
    // Uninitialized & not in official
    .filter(
      (pool) => pool.account.data[0] !== 0 && !MAINNET_LIQUIDITY_POOLS.find((p) => p.id === pool.pubkey.toBase58()),
    )
    .map((pool) => {
      return { id: pool.pubkey.toBase58(), lp: { version: 4 } };
    });

  const official = await generateLiquidityPoolsInfo(connection, MAINNET_LIQUIDITY_POOLS);
  const unOfficial = await generateLiquidityPoolsInfo(connection, unOfficialPools, false);

  // mainnet
  writeJsonFile(`${liquidityDir}/mainnet.json`, {
    name: "Raydium Mainnet Liquidity Pools",
    timestamp: getTimestamp(),
    version: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    official,
    unOfficial,
  });

  consola.info(`Built liquidity pools: official ${official.length} unofficial ${unOfficial.length}`);
}

(async function () {
  const endpoint = process.env.RPC_ENDPOINT;
  if (!endpoint) {
    consola.error("RPC_ENDPOINT not set on .env file.");
    process.exit(1);
  }

  try {
    const connection = new Connection(endpoint);

    consola.info("Building liquidity pools JSON file...");
    await buildLiquidityPools(connection);
  } catch (error) {
    consola.error(error);
    process.exit(1);
  }
})();
