import { Connection, PublicKey, Transaction } from "@solana/web3.js";

/** @see https://giters.com/solana-labs/wallet-adapter/issues/226 it's just a temporary fix */

interface AttachBlockHash {
  connection: Connection;
  owner: PublicKey;
  transactions: Transaction[];
  forceBlockHash?: string;
}
export async function attachRecentBlockhash({
  connection,
  owner,
  transactions,
  forceBlockHash,
}: AttachBlockHash): Promise<void> {
  for await (const transaction of transactions) {
    if (forceBlockHash) {
      // if provide forceBlockHash , don't re get any more
      transaction.recentBlockhash = forceBlockHash;
    }

    if (!transaction.recentBlockhash) {
      // recentBlockhash may already attached by sdk
      transaction.recentBlockhash = await getRecentBlockhash(connection);
    }
    transaction.feePayer = owner;
  }
}

export async function getRecentBlockhash(connection: Connection): Promise<string> {
  try {
    return (await connection.getLatestBlockhash?.())?.blockhash || (await connection.getRecentBlockhash()).blockhash;
  } catch {
    return (await connection.getRecentBlockhash()).blockhash;
  }
}
