import { Connection } from "@solana/web3.js";
import consola from "consola";
import dotenv from "dotenv";

import { ApiPoolInfoItem, Liquidity, MAINNET_OFFICIAL_LIQUIDITY_POOLS, poolKeys2JsonInfo } from "../../src";
import { getTimestamp, mkdirIfNotExists, writeJsonFile } from "../util";

dotenv.config();

async function buildLiquidityPools(connection: Connection) {
  const liquidityDir = "./dist/liquidity";

  mkdirIfNotExists("./dist");
  mkdirIfNotExists(liquidityDir);

  // raydium v4
  const poolsKeys = await Liquidity.fetchAllPoolKeys(connection);

  const official: ApiPoolInfoItem[] = [];
  const unOfficial: ApiPoolInfoItem[] = [];

  for (const poolKeys of poolsKeys) {
    if (MAINNET_OFFICIAL_LIQUIDITY_POOLS.includes(poolKeys.id.toBase58())) {
      official.push(poolKeys2JsonInfo(poolKeys));
    } else {
      unOfficial.push(poolKeys2JsonInfo(poolKeys));
    }
  }

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
