import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { Owner } from "./owner";

interface TxBuilderInit {
  connection: Connection;
  feePayer: PublicKey;
  owner?: Owner;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
}

export interface AddInstructionParam {
  instructions?: TransactionInstruction[];
  endInstructions?: TransactionInstruction[];
  signers?: Signer[];
}

export class TxBuilder {
  private connection: Connection;
  private owner?: Owner;
  private instructions: TransactionInstruction[] = [];
  private endInstructions: TransactionInstruction[] = [];
  private signers: Signer[] = [];
  private feePayer: PublicKey;
  private signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;

  constructor(params: TxBuilderInit) {
    this.connection = params.connection;
    this.feePayer = params.feePayer;
    this.signAllTransactions = params.signAllTransactions;
    this.owner = params.owner;
  }

  public addInstruction({ instructions = [], endInstructions = [], signers = [] }: AddInstructionParam): TxBuilder {
    this.instructions.push(...instructions);
    this.endInstructions.push(...endInstructions);
    this.signers.push(...signers);
    return this;
  }

  public async build(): Promise<{
    transaction: Transaction;
    signers: Signer[];
    execute: () => Promise<string>;
  }> {
    const recentBlockHash = await getRecentBlockHash(this.connection);

    const transaction = new Transaction();
    transaction.recentBlockhash = recentBlockHash;
    transaction.add(...this.instructions, ...this.endInstructions);
    transaction.feePayer = this.feePayer;

    return {
      transaction,
      signers: this.signers,
      execute: async (): Promise<string> => {
        if (this.owner) {
          return sendAndConfirmTransaction(this.connection, transaction, this.signers);
        }
        if (this.signAllTransactions) {
          const signedTx = await this.signAllTransactions([transaction]);
          return this.connection.sendRawTransaction(signedTx[0].serialize());
        }
        throw new Error("please connect wallet first");
      },
    };
  }
}

export async function getRecentBlockHash(connection: Connection): Promise<string> {
  try {
    return (await connection.getLatestBlockhash?.())?.blockhash || (await connection.getRecentBlockhash()).blockhash;
  } catch {
    return (await connection.getRecentBlockhash()).blockhash;
  }
}
