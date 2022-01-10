import consola from "consola";
import got from "got";

import { MAINNET_SPL_TOKENS } from "../../src/token";

interface CoingeckoCoinList {
  id: string;
  symbol: string;
  name: string;
}

interface CoingeckoCoinPlatforms {
  solana: string;
}

interface CoingeckoCoinInfo {
  name: string;
  platforms: CoingeckoCoinPlatforms;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const coingeckoApi = "https://api.coingecko.com/api/v3";

  // /search
  const coinsList: CoingeckoCoinList[] = await got(`${coingeckoApi}/coins/list`).json();
  consola.success("Got coingecko coins");

  for (const [symbol, splInfo] of Object.entries(MAINNET_SPL_TOKENS)) {
    if (splInfo.extensions && splInfo.extensions.coingeckoId) continue;

    let found = false;
    const suspects = coinsList.filter((coin) => coin.symbol.toLowerCase() === splInfo.symbol.toLowerCase());

    for (const { id: coingeckoId } of suspects) {
      let requested = false;

      while (!requested) {
        try {
          const { name, platforms }: CoingeckoCoinInfo = await got(`${coingeckoApi}/coins/${coingeckoId}`).json();
          requested = true;

          if (platforms.solana === splInfo.mint) {
            found = true;

            console.log(
              `${symbol}: ${JSON.stringify(
                {
                  ...splInfo,
                  ...{
                    name,
                    extensions: {
                      coingeckoId,
                    },
                  },
                },
                null,
                2,
              )},`,
            );
          }
        } catch (error) {
          await sleep(1 * 1000);
        }
      }
    }

    if (!found) {
      console.log(`${symbol}: ${JSON.stringify(splInfo, null, 2)},`);
    }
  }
})();
