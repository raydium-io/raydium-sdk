import { Connection, PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import consola from "consola";
import dotenv from "dotenv";

import { getMultipleAccountsInfo } from "../../src/common";
import { Farm, FarmPoolBaseInfo, FarmPoolJsonInfoV1, MAINNET_FARM_POOLS } from "../../src/farm";
import { SPL_ACCOUNT_LAYOUT } from "../../src/spl";
import { getTimestamp, mkdirIfNotExists, writeJsonFile } from "../util";

dotenv.config();

async function generateFarmPoolsInfo(connection: Connection, pools: FarmPoolBaseInfo[]) {
  const ids = pools.map((pool) => {
    // check farm pool match lp token
    if (!pool.lp) {
      consola.error(`[Farm ${pool.id}] not match LP token`);
      process.exit(1);
    }
    return new PublicKey(pool.id);
  });

  const farmPools: FarmPoolJsonInfoV1[] = [];

  // fetch farm pools
  const poolAccountsInfo = await getMultipleAccountsInfo(connection, ids);
  for (const index in poolAccountsInfo) {
    const id = ids[index];
    const pool = pools[index];
    const accountInfo = poolAccountsInfo[index];

    if (!accountInfo) {
      consola.error(`[Farm ${pool.id}] state null account info`);
      process.exit(1);
    }

    const { data } = accountInfo;
    const { version, lp } = pool;

    const programId = Farm.getProgramId(version);

    const FARM_STATE_LAYOUT = Farm.getStateLayout(version);

    if (data.length !== FARM_STATE_LAYOUT.span) {
      consola.error(
        `[Farm ${pool.id}] state invalid data length: ${chalk.green(FARM_STATE_LAYOUT.span)} => ${chalk.red(
          data.length,
        )}`,
      );
      process.exit(1);
    }

    const { publicKey: authority } = await Farm.getAssociatedAuthority({ programId, poolId: id });

    const { lpVault, rewardVaults } = FARM_STATE_LAYOUT.decode(data);

    farmPools[index] = {
      id: pool.id,
      lpMint: lp.mint,
      rewardMints: [],
      version,
      programId: programId.toBase58(),

      authority: authority.toBase58(),
      lpVault: lpVault.toBase58(),
      rewardVaults: rewardVaults.map((pubkey) => pubkey.toBase58()),
    };
  }

  const lpVaults = farmPools.map((pool) => {
    return new PublicKey(pool.lpVault);
  });
  // fetch lp vaults
  const lpVaultsInfo = await getMultipleAccountsInfo(connection, lpVaults);
  for (const index in lpVaultsInfo) {
    const pool = farmPools[index];
    const lpVault = lpVaults[index];
    const vaultInfo = lpVaultsInfo[index];

    if (!vaultInfo) {
      consola.error(`[Farm LP Valut ${lpVault}] [Farm ${pool.id}] valut null account info`);
      process.exit(1);
    }

    const { data } = vaultInfo;

    if (data.length !== SPL_ACCOUNT_LAYOUT.span) {
      consola.error(
        `[Farm LP Valut ${lpVault}] [Farm ${pool.id}] valut invalid data length: ${chalk.green(
          SPL_ACCOUNT_LAYOUT.span,
        )} => ${chalk.red(data.length)}`,
      );
      process.exit(1);
    }

    const { mint } = SPL_ACCOUNT_LAYOUT.decode(data);
    const mintAddress = mint.toBase58();

    // double check lp mint
    if (mintAddress !== pool.lpMint) {
      consola.error(
        `[Farm LP Valut ${lpVault}] [Farm ${pool.id}] valut invalid lp mint: ${chalk.red(pool.lpMint)} <=> ${chalk.red(
          mintAddress,
        )}`,
      );
      process.exit(1);
    }
  }

  const allRewardVaults: PublicKey[] = farmPools
    .map((pool) => pool.rewardVaults.map((pubkey) => new PublicKey(pubkey)))
    .flat();
  const rewardMints: string[] = [];
  // fetch lp vaults
  const rewardVaultsInfo = await getMultipleAccountsInfo(connection, allRewardVaults);
  for (const index in rewardVaultsInfo) {
    const rewardVault = allRewardVaults[index];
    const vaultInfo = rewardVaultsInfo[index];

    if (!vaultInfo) {
      consola.error(`[Farm Reward Valut ${rewardVault}] ${chalk.red(`valut null account info`)}`);
      process.exit(1);
    }

    const { data } = vaultInfo;

    if (data.length !== SPL_ACCOUNT_LAYOUT.span) {
      consola.error(
        `[Farm Reward Valut ${rewardVault}] valut invalid data length: ${chalk.green(
          SPL_ACCOUNT_LAYOUT.span,
        )} => ${chalk.red(data.length)}`,
      );
      process.exit(1);
    }

    const { mint } = SPL_ACCOUNT_LAYOUT.decode(data);
    const mintAddress = mint.toBase58();

    rewardMints.push(mintAddress);
  }

  for (const index in farmPools) {
    const farmPool = farmPools[index];

    for (let i = 0; i < farmPool.rewardVaults.length; i++) {
      farmPools[index].rewardMints.push(rewardMints[0]);
      // delete first
      rewardMints.shift();
    }
  }

  // double check rewardMints is not empty address and length equal to rewardVaults length
  for (const farmPool of farmPools) {
    const { rewardMints, rewardVaults } = farmPool;
    if (rewardMints.length !== rewardVaults.length) {
      consola.error(`[Farm Pool ${farmPool.id}] rewardMints length not equal to rewardVaults length`);
      process.exit(1);
    }

    for (const rewardMint of rewardMints) {
      if (!rewardMint) {
        consola.error(`[Farm Pool ${farmPool.id}] rewardMints has empty address`);
        process.exit(1);
      }
    }

    for (const rewardVault of rewardVaults) {
      if (!rewardVault) {
        consola.error(`[Farm Pool ${farmPool.id}] rewardVaults has empty address`);
        process.exit(1);
      }
    }
  }

  return farmPools;
}

async function buildFarmPools(connection: Connection) {
  const farmDir = "./dist/farm";

  mkdirIfNotExists("./dist");
  mkdirIfNotExists(farmDir);

  // mainnet
  writeJsonFile(`${farmDir}/mainnet.json`, {
    name: "Raydium Mainnet Farm Pools",
    timestamp: getTimestamp(),
    version: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    official: await generateFarmPoolsInfo(connection, MAINNET_FARM_POOLS),
  });
}

(async function () {
  const endpoint = process.env.RPC_ENDPOINT;
  if (!endpoint) {
    consola.error("RPC_ENDPOINT not set on .env file.");
    process.exit(1);
  }

  try {
    const connection = new Connection(endpoint);

    consola.info("Building farm pools JSON file...");
    await buildFarmPools(connection);
  } catch (error) {
    consola.error(error);
    process.exit(1);
  }
})();
