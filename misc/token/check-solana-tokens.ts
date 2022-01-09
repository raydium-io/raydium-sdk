import { tokens as SolanaTokens } from "@solana/spl-token-registry/dist/main/tokens/solana.tokenlist.json";
import { Connection } from "@solana/web3.js";
import consola from "consola";
import dotenv from "dotenv";

import { checkTokenList } from "./util";

dotenv.config();

(async function () {
  const endpoint = process.env.RPC_ENDPOINT;
  if (!endpoint) {
    consola.error("RPC_ENDPOINT not set on .env file.");
    process.exit(1);
  }

  try {
    const connection = new Connection(endpoint);

    const mainnetTokens = SolanaTokens.filter((token) => token.chainId === 101);

    consola.info("Checking @solana/spl-token-registry tokens info...");
    checkTokenList(
      connection,
      mainnetTokens.map((token) => {
        return {
          mint: token.address,
          decimals: token.decimals,
        };
      }),
    );
  } catch (error) {
    consola.error(error);
    process.exit(1);
  }
})();
