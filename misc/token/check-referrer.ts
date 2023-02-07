import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import chalk from "chalk";
import dotenv from "dotenv";

import { getMultipleAccountsInfo } from "../../src/common";
import { Spl } from "../../src/spl";
import { MAINNET_SPL_TOKENS } from "../../src/token";

dotenv.config();

(async function () {
  const endpoint = process.env.RPC_ENDPOINT;
  if (!endpoint) {
    console.log(chalk.red(`RPC_ENDPOINT not set on .env file.`));
    return;
  }

  const referrer = process.env.REFERRER_OWNER;
  if (!referrer) {
    console.log(chalk.red(`REFERRER_OWNER not set on .env file.`));
    return;
  }

  const payerPrivateKey = process.env.PAYER_PRIVATE_KEY;
  if (!payerPrivateKey) {
    console.log(chalk.red(`PAYER_PRIVATE_KEY not set exist on .env file.`));
    return;
  }
  const payer = Keypair.fromSecretKey(new Uint8Array(payerPrivateKey.split(",").map((k) => parseInt(k))));

  console.log(`Referrer owner: ${chalk.green(referrer)}`);

  const owner = new PublicKey(referrer);
  const connection = new Connection(endpoint);

  const mints: PublicKey[] = [];
  const atas: PublicKey[] = [];

  for (const tokenInfo of [...MAINNET_SPL_TOKENS]) {
    const mint = new PublicKey(tokenInfo.mint);
    mints.push(mint);
    atas.push(await Spl.getAssociatedTokenAddress({ mint, owner }));
  }

  const transaction = new Transaction({ feePayer: payer.publicKey });

  const accountsInfo = await getMultipleAccountsInfo(connection, atas);
  for (const index in accountsInfo) {
    const accountInfo = accountsInfo[index];

    if (!accountInfo) {
      const mint = mints[index];
      const ata = atas[index];
      transaction.add(
        Spl.makeCreateAssociatedTokenAccountInstruction({
          mint,
          associatedAccount: ata,
          owner,
          payer: payer.publicKey,
          instructionsType: []
        }),
      );
    }
  }
})();
