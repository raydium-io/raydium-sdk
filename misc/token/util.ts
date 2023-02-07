import { Connection, PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import consola from "consola";

import { getMultipleAccountsInfo } from "../../src/common";
import { SPL_MINT_LAYOUT } from "../../src/spl";

interface CheckTokenListConfig {
  throwError: boolean;
  bypassNullInfo: boolean;
}

export async function checkTokenList(
  connection: Connection,
  tokenList: { mint: string; decimals: number }[],
  customConfig?: CheckTokenListConfig,
) {
  const defaultConfig = {
    throwError: false,
    bypassNullInfo: true,
  };
  const config = { ...defaultConfig, ...customConfig };

  let accountInfoNull = 0;
  let invalidLength = 0;
  let invalidDecimals = 0;

  const accountsInfo = await getMultipleAccountsInfo(
    connection,
    tokenList.map((tokenInfo) => new PublicKey(tokenInfo.mint)),
  );
  for (const index in accountsInfo) {
    const tokenInfo = tokenList[index];
    const accountInfo = accountsInfo[index];

    if (!accountInfo) {
      !config.bypassNullInfo && console.error(`${tokenInfo.mint} ${chalk.red(`null account info`)}`);
      accountInfoNull += 1;
    } else {
      const { data } = accountInfo;
      if (data.length !== SPL_MINT_LAYOUT.span) {
        console.error(
          `${tokenInfo.mint} invalid data length: ${chalk.green(SPL_MINT_LAYOUT.span)} => ${chalk.red(data.length)}`,
        );
        invalidLength += 1;
      } else {
        const { decimals } = SPL_MINT_LAYOUT.decode(data);
        if (tokenInfo.decimals !== decimals) {
          console.error(
            `${tokenInfo.mint} invalid decimals: ${chalk.green(decimals)} => ${chalk.red(tokenInfo.decimals)}`,
          );
          invalidDecimals += 1;
        }
      }
    }
  }

  if (accountInfoNull > 0 || invalidLength > 0 || invalidDecimals > 0) {
    consola.info(
      `Account info null: ${chalk.red(accountInfoNull)}, invalid data length: ${chalk.red(
        invalidLength,
      )}, invalid decimals: ${chalk.red(invalidDecimals)}`,
    );
    if (config.throwError) {
      process.exit(1);
    }
  }
}
