import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  SimulatedTransactionResponse,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { SignAllTransactions } from "../raydium/type";

import { createLogger } from "./logger";
import { Owner } from "./owner";

const logger = createLogger("Raydium_txTool");
interface TxBuilderInit {
  connection: Connection;
  feePayer: PublicKey;
  owner?: Owner;
  signAllTransactions?: SignAllTransactions;
}

export interface AddInstructionParam {
  instructions?: TransactionInstruction[];
  endInstructions?: TransactionInstruction[];
  signers?: Signer[];
}

export interface TxBuildData {
  transaction: Transaction;
  signers: Signer[];
  execute: () => Promise<string>;
  extInfo: Record<string, any>;
}

export interface MultiTxBuildData {
  transactions: Transaction[];
  signers: Signer[][];
  execute: () => Promise<string[]>;
  extInfo: Record<string, any>;
}

export class TxBuilder {
  private connection: Connection;
  private owner?: Owner;
  private instructions: TransactionInstruction[] = [];
  private endInstructions: TransactionInstruction[] = [];
  private signers: Signer[] = [];
  private feePayer: PublicKey;
  private signAllTransactions?: SignAllTransactions;

  constructor(params: TxBuilderInit) {
    this.connection = params.connection;
    this.feePayer = params.feePayer;
    this.signAllTransactions = params.signAllTransactions;
    this.owner = params.owner;
  }

  get AllTxData(): {
    instructions: TransactionInstruction[];
    endInstructions: TransactionInstruction[];
    signers: Signer[];
  } {
    return {
      instructions: this.instructions,
      endInstructions: this.endInstructions,
      signers: this.signers,
    };
  }

  get allInstructions(): TransactionInstruction[] {
    return [...this.instructions, ...this.endInstructions];
  }

  public addInstruction({ instructions = [], endInstructions = [], signers = [] }: AddInstructionParam): TxBuilder {
    this.instructions.push(...instructions);
    this.endInstructions.push(...endInstructions);
    this.signers.push(...signers);
    return this;
  }

  public build(extInfo?: Record<string, any>): TxBuildData {
    const transaction = new Transaction();
    if (this.allInstructions.length) transaction.add(...this.allInstructions);
    transaction.feePayer = this.feePayer;

    return {
      transaction,
      signers: this.signers,
      execute: async (): Promise<string> => {
        const recentBlockHash = await getRecentBlockHash(this.connection);
        transaction.recentBlockhash = recentBlockHash;
        if (this.owner?.isKeyPair) {
          return sendAndConfirmTransaction(this.connection, transaction, this.signers);
        }
        if (this.signAllTransactions) {
          if (this.signers.length) transaction.partialSign(...this.signers);
          const txs = await this.signAllTransactions([transaction]);
          return await this.connection.sendRawTransaction(txs[0].serialize(), { skipPreflight: true });
        }
        throw new Error("please connect wallet first");
      },
      extInfo: extInfo || {},
    };
  }

  public buildMultiTx(params: { extraPreBuildData?: TxBuildData[]; extInfo?: Record<string, any> }): MultiTxBuildData {
    const { extraPreBuildData = [], extInfo } = params;
    const { transaction } = this.build(extInfo);

    const filterExtraBuildData = extraPreBuildData.filter((data) => data.transaction.instructions.length > 0);

    const allTransactions: Transaction[] = [...filterExtraBuildData.map((data) => data.transaction), transaction];
    const allSigners: Signer[][] = [...filterExtraBuildData.map((data) => data.signers), this.signers];

    return {
      transactions: allTransactions,
      signers: allSigners,
      execute: async (): Promise<string[]> => {
        const recentBlockHash = await getRecentBlockHash(this.connection);
        if (this.owner?.isKeyPair) {
          return await Promise.all(
            allTransactions.map(async (tx, idx) => {
              tx.recentBlockhash = recentBlockHash;
              return await sendAndConfirmTransaction(this.connection, tx, allSigners[idx]);
            }),
          );
        }
        if (this.signAllTransactions) {
          const partialSignedTxs = allTransactions.map((tx, idx) => {
            tx.recentBlockhash = recentBlockHash;
            if (allSigners[idx].length) tx.partialSign(...allSigners[idx]);
            return tx;
          });
          const signedTxs = await this.signAllTransactions(partialSignedTxs);

          const txIds: string[] = [];
          for (let i = 0; i < signedTxs.length; i += 1) {
            const txId = await this.connection.sendRawTransaction(signedTxs[i].serialize(), { skipPreflight: true });
            txIds.push(txId);
          }
          return txIds;
        }
        throw new Error("please connect wallet first");
      },
      extInfo: extInfo || {},
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
export function forecastTransactionSize(instructions: TransactionInstruction[], signers: PublicKey[]): boolean {
  if (instructions.length < 1) logger.logWithError(`no instructions provided: ${instructions.toString()}`);
  if (signers.length < 1) logger.logWithError(`no signers provided:, ${signers.toString()}`);

  const transaction = new Transaction();
  transaction.recentBlockhash = "11111111111111111111111111111111";
  transaction.feePayer = signers[0];
  transaction.add(...instructions);

  try {
    transaction.serialize({ verifySignatures: false });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Simulates multiple instruction
 */
/**
 * Simulates multiple instruction
 */
export async function simulateMultipleInstruction(
  connection: Connection,
  instructions: TransactionInstruction[],
  keyword: string,
  batchRequest = true,
): Promise<string[]> {
  const feePayer = new PublicKey("RaydiumSimuLateTransaction11111111111111111");

  const transactions: Transaction[] = [];

  let transaction = new Transaction();
  transaction.feePayer = feePayer;

  for (const instruction of instructions) {
    if (!forecastTransactionSize([...transaction.instructions, instruction], [feePayer])) {
      transactions.push(transaction);
      transaction = new Transaction();
      transaction.feePayer = feePayer;
    }
    transaction.add(instruction);
  }
  if (transaction.instructions.length > 0) {
    transactions.push(transaction);
  }

  let results: SimulatedTransactionResponse[] = [];

  try {
    results = await simulateTransaction(connection, transactions, batchRequest);
    if (results.find((i) => i.err !== null)) throw Error("rpc simulateTransaction error");
  } catch (error) {
    if (error instanceof Error) {
      logger.logWithError("failed to simulate for instructions", "RPC_ERROR", {
        message: error.message,
      });
    }
  }

  const logs: string[] = [];
  for (const result of results) {
    logger.debug("simulate result:", result);

    if (result.logs) {
      const filteredLog = result.logs.filter((log) => log && log.includes(keyword));
      logger.debug("filteredLog:", logs);
      if (!filteredLog.length) logger.logWithError("simulate log not match keyword", "keyword", keyword);
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

export interface ProgramAddress {
  publicKey: PublicKey;
  nonce: number;
}
export async function findProgramAddress(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey,
): Promise<ProgramAddress> {
  const [publicKey, nonce] = await PublicKey.findProgramAddress(seeds, programId);
  return { publicKey, nonce };
}

export async function simulateTransaction(
  connection: Connection,
  transactions: Transaction[],
  batchRequest?: boolean,
): Promise<any[]> {
  let results: any[] = [];
  if (batchRequest) {
    const getLatestBlockhash = await connection.getLatestBlockhash();

    const encodedTransactions: string[] = [];
    for (const transaction of transactions) {
      transaction.recentBlockhash = getLatestBlockhash.blockhash;
      transaction.lastValidBlockHeight = getLatestBlockhash.lastValidBlockHeight;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const message = transaction._compile();
      const signData = message.serialize();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const wireTransaction = transaction._serialize(signData);
      const encodedTransaction = wireTransaction.toString("base64");

      encodedTransactions.push(encodedTransaction);
    }

    const batch = encodedTransactions.map((keys) => {
      const args = connection._buildArgs([keys], undefined, "base64");
      return {
        methodName: "simulateTransaction",
        args,
      };
    });

    const reqData: { methodName: string; args: any[] }[][] = [];
    const itemReqIndex = 20;
    for (let i = 0; i < Math.ceil(batch.length / itemReqIndex); i++) {
      reqData.push(batch.slice(i * itemReqIndex, (i + 1) * itemReqIndex));
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    results = await (
      await Promise.all(
        reqData.map(async (i) => (await (connection as any)._rpcBatchRequest(i)).map((ii) => ii.result.value)),
      )
    ).flat();
  } else {
    try {
      results = await Promise.all(
        transactions.map(async (transaction) => await (await connection.simulateTransaction(transaction)).value),
      );
    } catch (error) {
      if (error instanceof Error) {
        logger.logWithError("failed to get info for multiple accounts", "RPC_ERROR", {
          message: error.message,
        });
      }
    }
  }

  return results;
}
