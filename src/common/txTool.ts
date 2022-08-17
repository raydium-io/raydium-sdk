import {
  Connection,
  PACKET_DATA_SIZE,
  PublicKey,
  RpcResponseAndContext,
  sendAndConfirmTransaction,
  Signer,
  SimulatedTransactionResponse,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { createLogger } from "./logger";
import { Owner } from "./owner";

const logger = createLogger("Raydium.txTool");
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

/**
 * Forecast transaction size
 */
export function forecastTransactionSize(instructions: TransactionInstruction[], signers: PublicKey[]): number {
  if (instructions.length < 1) logger.logWithError(`no instructions provided: ${instructions.toString()}`);
  if (signers.length < 1) logger.logWithError(`no signers provided:, ${signers.toString()}`);

  const transaction = new Transaction();
  transaction.recentBlockhash = "11111111111111111111111111111111";
  transaction.feePayer = signers[0];
  transaction.add(...instructions);

  const message = transaction.compileMessage().serialize();
  // SIGNATURE_LENGTH = 64
  const transactionLength = signers.length + signers.length * 64 + message.length;
  return transactionLength;
}

/**
 * Simulates multiple instruction
 */
export async function simulateMultipleInstruction(
  connection: Connection,
  instructions: TransactionInstruction[],
  keyword: string,
): Promise<any> {
  const feePayer = new PublicKey("RaydiumSimuLateTransaction11111111111111111");

  const transactions: Transaction[] = [];

  let transaction = new Transaction();
  transaction.feePayer = feePayer;

  for (const instruction of instructions) {
    if (forecastTransactionSize([...transaction.instructions, instruction], [feePayer]) > PACKET_DATA_SIZE) {
      transactions.push(transaction);
      transaction = new Transaction();
      transaction.feePayer = feePayer;
      transaction.add(instruction);
    } else {
      transaction.add(instruction);
    }
  }
  if (transaction.instructions.length > 0) {
    transactions.push(transaction);
  }

  let results: RpcResponseAndContext<SimulatedTransactionResponse>[] = [];

  try {
    results = await Promise.all(transactions.map((transaction) => connection.simulateTransaction(transaction)));
  } catch (error) {
    if (error instanceof Error) {
      logger.logWithError(`failed to simulate for instructions, RPC_ERROR, ${error.message}`);
    }
  }

  const logs: string[] = [];
  for (const result of results) {
    const { value } = result;
    logger.debug("simulate result:", result);

    if (value.logs) {
      const filteredLog = value.logs.filter((log) => log && log.includes(keyword));
      logger.debug("filteredLog:", logs);
      if (!filteredLog.length) logger.logWithError(` "simulate log not match keyword, keyword: ${keyword}`);
      logs.push(...filteredLog);
    }
  }

  return logs;
}

export function parseSimulateLogToJson(log: string, keyword: string): any {
  const results = log.match(/{["\w:,]+}/g);
  if (!results || results.length !== 1) {
    return logger.logWithError(`simulate log fail to match json, keyword: ${keyword}`);
  }

  return results[0];
}

export function parseSimulateValue(log: string, key: string): any {
  const reg = new RegExp(`"${key}":(\\d+)`, "g");

  const results = reg.exec(log);
  if (!results || results.length !== 2) {
    return logger.logWithError(`simulate log fail to match key", key: ${key}`);
  }

  return results[1];
}
