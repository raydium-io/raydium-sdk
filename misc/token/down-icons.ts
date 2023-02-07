import { tokens as SolanaTokens } from "@solana/spl-token-registry/dist/main/tokens/solana.tokenlist.json";
import consola from "consola";
import fs from "fs";
import got from "got";
import sharp from "sharp";

import { MAINNET_SPL_TOKENS } from "../../src/token";
import { mkdirIfNotExists } from "../util";

(async () => {
  const iconsDir = "./icons";
  mkdirIfNotExists(iconsDir);

  // const solanaMints = [...SolanaTokens]
  //   .filter(
  //     (token) =>
  //       token.tags &&
  //       (token.tags.length < 1 ||
  //         token.tags.includes('stablecoin') ||
  //         token.tags.includes('wrapped') ||
  //         token.tags.includes('wrapped-sollet'))
  //   )
  //   .map((token) => token.address);

  const mints = [...MAINNET_SPL_TOKENS].map((token) => token.mint);

  for (const mint of mints) {
    const iconFileName = `${iconsDir}/${mint}.png`;

    const token = SolanaTokens.find((t) => t.address === mint);

    if (token) {
      if (token.logoURI) {
        if (!fs.existsSync(`${iconsDir}/${mint}.png`)) {
          consola.info(`${mint} icon downloading...`);

          try {
            const response = await got(token.logoURI, { retry: 0 });
            const { rawBody } = response;
            await sharp(rawBody)
              // preserving aspect ratio, resize the image to be as large as possible while ensuring its dimensions are less than or equal to both those specified
              .resize({ height: 100, width: 100, fit: "inside" })
              // preserving aspect ratio, contain within both provided dimensions using "letterboxing" where necessary
              .resize({ height: 100, width: 100, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
              .png()
              .toFile(iconFileName);
          } catch (error) {
            consola.error(`Icon url not exist: ${mint} ${token.logoURI}`);
          }
        }
      } else {
        consola.error(`Not found token logo url: ${mint}`);
      }
    } else {
      consola.error(`Not found token info: ${mint}`);
    }
  }
})();
