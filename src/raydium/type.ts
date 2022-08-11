import { Signer, Transaction } from "@solana/web3.js";

import { ApiTokenCategory, ApiTokenInfo } from "../api";

export interface RaydiumTokenInfo extends ApiTokenInfo {
  category: ApiTokenCategory;
}

export type SignAllTransactions = (transactions: Transaction[]) => Promise<Transaction[]>;

export interface MakeTransaction {
  signers: Signer[];
  transaction: Transaction;
  excute: () => Promise<string>;
}
