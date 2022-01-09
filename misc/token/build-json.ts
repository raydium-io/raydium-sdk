import { Connection } from "@solana/web3.js";
import chalk from "chalk";
import consola from "consola";
import dotenv from "dotenv";

import {
  LpTokenInfo, LpTokens, LpTokensJsonInfo, MAINNET_LP_TOKENS, MAINNET_SPL_TOKENS, SplTokenInfo, SplTokensJsonInfo,
} from "../../src/token";
import { getTimestamp, mkdirIfNotExists, writeJsonFile } from "../util";

import { checkTokenList } from "./util";

dotenv.config();

class SolanaFormatTokenList {
  static generateTokenTemplate(name: string, tokens: Array<any>) {
    return {
      name,
      keywords: ["solana", "spl", "raydium"],
      tags: {
        "lp-token": {
          name: "lp-token",
          description: "Asset representing liquidity provider token",
        },
      },
      timestamp: getTimestamp(),
      version: {
        major: 1,
        minor: 0,
        patch: 0,
      },
      tokens,
    };
  }

  static generateTokensInfo(tokens: Array<SplTokenInfo | LpTokenInfo>, chainId: number) {
    const TOKENS: any[] = [];

    for (const tokenInfo of tokens) {
      TOKENS.push(this.parseTokenInfo(tokenInfo, chainId));
    }

    return TOKENS;
  }

  static parseTokenInfo(tokenInfo: SplTokenInfo | LpTokenInfo, chainId: number) {
    const isLp = "version" in tokenInfo;
    const tags: string[] = [];
    let extensions = {};

    if (isLp) {
      tags.push("lp-token");
    } else {
      extensions = tokenInfo.extensions;
    }

    return {
      chainId,
      address: tokenInfo.mint,
      symbol: tokenInfo.symbol,
      name: tokenInfo.name,
      decimals: tokenInfo.decimals,
      tags,
      extensions,
    };
  }
}

class RaydiumFormatTokenList {
  static generateTokenTemplate(name: string, tokens: object) {
    return {
      name,
      timestamp: getTimestamp(),
      version: {
        major: 1,
        minor: 0,
        patch: 0,
      },
      ...tokens,
    };
  }

  static generateTokensInfo(splTokens: SplTokensJsonInfo, lpTokens: LpTokensJsonInfo) {
    return {
      spl: splTokens,
      lp: lpTokens,
    };
  }

  static parseLpInfo(tokenInfo: LpTokens) {
    const lps: LpTokensJsonInfo = {
      *[Symbol.iterator]() {
        yield* Object.values(this);
      },
    };

    for (const [name, lpToken] of Object.entries(tokenInfo)) {
      lps[name] = {
        symbol: lpToken.symbol,
        name: lpToken.name,
        mint: lpToken.mint,

        base: lpToken.base.mint,
        quote: lpToken.quote.mint,
        decimals: lpToken.decimals,

        version: lpToken.version,
      };
    }

    return lps;
  }
}

function buildTokensJsonFile() {
  const tokenDir = "./dist/token";

  mkdirIfNotExists("./dist");
  mkdirIfNotExists(tokenDir);

  /* ================= solana format ================= */
  // mainnet
  writeJsonFile(
    `${tokenDir}/solana.mainnet.json`,
    SolanaFormatTokenList.generateTokenTemplate(
      "Raydium Mainnet Token List",
      SolanaFormatTokenList.generateTokensInfo([...MAINNET_SPL_TOKENS, ...MAINNET_LP_TOKENS], 101),
    ),
  );

  // testnet
  // writeJsonFile(
  //   `${tokenDir}/solana.testnet.json`,
  //   SolanaFormatTokenList.generateTokenTemplate(
  //     'Raydium Testnet Token List',
  //     SolanaFormatTokenList.generateTokensInfo([...TESTNET_SPL_TOKENS, ...TESTNET_LP_TOKENS], 102)
  //   )
  // );

  // devnet
  // writeJsonFile(
  //   `${tokenDir}/solana.devnet.json`,
  //   SolanaFormatTokenList.generateTokenTemplate(
  //     'Raydium Devnet Token List',
  //     SolanaFormatTokenList.generateTokensInfo([...DEVNET_SPL_TOKENS, ...DEVNET_LP_TOKENS], 103)
  //   )
  // );

  // all network
  // writeJsonFile(
  //   'all',
  //   SolanaFormatTokenList.generateTokenTemplate('Raydium Token List', [
  //     ...SolanaFormatTokenList.generateTokensInfo([...MAINNET_SPL_TOKENS, ...MAINNET_LP_TOKENS], 101),
  //     ...SolanaFormatTokenList.generateTokensInfo([...TESTNET_SPL_TOKENS, ...TESTNET_LP_TOKENS], 102),
  //     ...SolanaFormatTokenList.generateTokensInfo([...DEVNET_SPL_TOKENS, ...DEVNET_LP_TOKENS], 103)
  //   ])
  // );

  /* ================= raydium format ================= */
  // mainnet
  writeJsonFile(
    `${tokenDir}/raydium.mainnet.json`,
    RaydiumFormatTokenList.generateTokenTemplate(
      "Raydium Mainnet Token List",
      RaydiumFormatTokenList.generateTokensInfo(
        MAINNET_SPL_TOKENS,
        RaydiumFormatTokenList.parseLpInfo(MAINNET_LP_TOKENS),
      ),
    ),
  );
}

(async function () {
  const endpoint = process.env.RPC_ENDPOINT;
  if (!endpoint) {
    consola.error("RPC_ENDPOINT not set on .env file.");
    process.exit(1);
  }

  try {
    const connection = new Connection(endpoint);

    const mainnetTokens = [...MAINNET_SPL_TOKENS, ...MAINNET_LP_TOKENS];

    consola.info("Checking local tokens info...");
    checkTokenList(
      connection,
      mainnetTokens.map((token) => {
        // check lp match base quote token
        if ("version" in token && (!token.base || !token.quote)) {
          console.error(chalk.red(`LP: ${token.mint} not match base/quote token`));
          process.exit(1);
        }

        return {
          mint: token.mint,
          decimals: token.decimals,
        };
      }),
      {
        throwError: true,
        bypassNullInfo: false,
      },
    );

    consola.info("Building tokens JSON file...");
    buildTokensJsonFile();
  } catch (error) {
    consola.error(error);
    process.exit(1);
  }
})();
