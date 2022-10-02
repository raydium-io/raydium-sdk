// import BN from 'bn.js';

// import { Spl, SPL_ACCOUNT_LAYOUT } from '../spl';
// import { TOKEN_PROGRAM_ID } from './id';

import {
  AccountInfo, Commitment, Connection, PACKET_DATA_SIZE, PublicKey, RpcResponseAndContext, SimulatedTransactionResponse,
  Transaction, TransactionInstruction,
} from "@solana/web3.js";

import { chunkArray } from "./lodash";
import { Logger } from "./logger";

const logger = Logger.from("common/web3");

interface MultipleAccountsJsonRpcResponse {
  jsonrpc: string;
  id: string;
  error?: {
    code: number;
    message: string;
  };
  result: {
    context: { slot: number };
    value: { data: Array<string>; executable: boolean; lamports: number; owner: string; rentEpoch: number }[];
  };
}

export interface GetMultipleAccountsInfoConfig {
  batchRequest?: boolean;
  commitment?: Commitment;
}

// export async function batchGetMultipleAccountsInfo() {}

export async function getMultipleAccountsInfo(
  connection: Connection,
  publicKeys: PublicKey[],
  config?: GetMultipleAccountsInfoConfig,
): Promise<(AccountInfo<Buffer> | null)[]> {
  const { batchRequest, commitment } = {
    // default
    ...{
      batchRequest: false,
    },
    // custom
    ...config,
  };

  const chunkedKeys = chunkArray(publicKeys, 100);
  let results: (AccountInfo<Buffer> | null)[][] = new Array(chunkedKeys.length).fill([]);

  if (batchRequest) {
    const batch = chunkedKeys.map((keys) => {
      const args = connection._buildArgs([keys.map((key) => key.toBase58())], commitment, "base64");
      return {
        methodName: "getMultipleAccounts",
        args,
      };
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const unsafeResponse: MultipleAccountsJsonRpcResponse[] = await connection._rpcBatchRequest(batch);
    results = unsafeResponse.map((unsafeRes: MultipleAccountsJsonRpcResponse) => {
      if (unsafeRes.error) {
        return logger.throwError("failed to get info for multiple accounts", Logger.errors.RPC_ERROR, {
          message: unsafeRes.error.message,
        });
      }

      return unsafeRes.result.value.map((accountInfo) => {
        if (accountInfo) {
          const { data, executable, lamports, owner, rentEpoch } = accountInfo;

          if (data.length !== 2 && data[1] !== "base64") {
            return logger.throwError("info must be base64 encoded", Logger.errors.RPC_ERROR);
          }

          return {
            data: Buffer.from(data[0], "base64"),
            executable,
            lamports,
            owner: new PublicKey(owner),
            rentEpoch,
          };
        } else {
          return null;
        }
      });
    });
  } else {
    try {
      results = (await Promise.all(
        chunkedKeys.map((keys) => connection.getMultipleAccountsInfo(keys, commitment)),
      )) as (AccountInfo<Buffer> | null)[][];
    } catch (error) {
      if (error instanceof Error) {
        return logger.throwError("failed to get info for multiple accounts", Logger.errors.RPC_ERROR, {
          message: error.message,
        });
      }
    }
  }

  return results.flat();
}

export async function getMultipleAccountsInfoWithCustomFlags<T extends { pubkey: PublicKey }>(
  connection: Connection,
  publicKeysWithCustomFlag: T[],
  config?: GetMultipleAccountsInfoConfig,
): Promise<({ accountInfo: AccountInfo<Buffer> | null } & T)[]> {
  const multipleAccountsInfo = await getMultipleAccountsInfo(
    connection,
    publicKeysWithCustomFlag.map((o) => o.pubkey),
    config,
  );

  return publicKeysWithCustomFlag.map((o, idx) => ({ ...o, accountInfo: multipleAccountsInfo[idx] }));
}

export interface GetTokenAccountsByOwnerConfig {
  commitment?: Commitment;
}

// export async function getTokenAccountsByOwner(
//   connection: Connection,
//   owner: PublicKey,
//   config?: GetTokenAccountsByOwnerConfig
// ) {
//   const defaultConfig = {};
//   const customConfig = { ...defaultConfig, ...config };

//   const solReq = connection.getAccountInfo(owner, customConfig.commitment);
//   const tokenReq = connection.getTokenAccountsByOwner(
//     owner,
//     {
//       programId: TOKEN_PROGRAM_ID
//     },
//     customConfig.commitment
//   );

//   const [solResp, tokenResp] = await Promise.all([solReq, tokenReq]);

//   const accounts: {
//     publicKey?: PublicKey;
//     mint?: PublicKey;
//     isAssociated?: boolean;
//     amount: BN;
//     isNative: boolean;
//   }[] = [];

//   for (const { pubkey, account } of tokenResp.value) {
//     // double check layout length
//     if (account.data.length !== SPL_ACCOUNT_LAYOUT.span) {
//       return logger.throwArgumentError('invalid token account layout length', 'publicKey', pubkey);
//     }

//     const { mint, amount } = SPL_ACCOUNT_LAYOUT.decode(account.data);
//     const associatedTokenAddress = await Spl.getAssociatedTokenAddress({ mint, owner });

//     accounts.push({
//       publicKey: pubkey,
//       mint,
//       isAssociated: associatedTokenAddress.equals(pubkey),
//       amount,
//       isNative: false
//     });
//   }

//   if (solResp) {
//     accounts.push({
//       amount: new BN(solResp.lamports),
//       isNative: true
//     });
//   }

//   return accounts;
// }

/**
 * Forecast transaction size
 */
export function forecastTransactionSize(instructions: TransactionInstruction[], signers: PublicKey[]) {
  if (instructions.length < 1) {
    return logger.throwArgumentError("no instructions provided", "instructions", instructions);
  }
  if (signers.length < 1) {
    return logger.throwArgumentError("no signers provided", "signers", signers);
  }

  const transaction = new Transaction({
    recentBlockhash: "11111111111111111111111111111111",
    feePayer: signers[0],
  });

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
) {
  const feePayer = new PublicKey("RaydiumSimuLateTransaction11111111111111111");

  const transactions: Transaction[] = [];

  let transaction = new Transaction({ feePayer });

  for (const instruction of instructions) {
    if (forecastTransactionSize([...transaction.instructions, instruction], [feePayer]) > PACKET_DATA_SIZE - 170) {
      transactions.push(transaction);
      transaction = new Transaction({ feePayer });
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
      return logger.throwError("failed to simulate for instructions", Logger.errors.RPC_ERROR, {
        message: error.message,
      });
    }
  }

  const logs: string[] = [];
  for (const result of results) {
    const { value } = result;
    logger.debug("simulate result:", result);

    if (value.logs) {
      const filteredLog = value.logs.filter((log) => log && log.includes(keyword));
      logger.debug("filteredLog:", logs);

      logger.assertArgument(filteredLog.length !== 0, "simulate log not match keyword", "keyword", keyword);

      logs.push(...filteredLog);
    }
  }

  return logs;
}

export function parseSimulateLogToJson(log: string, keyword: string) {
  const results = log.match(/{["\w:,]+}/g);
  if (!results || results.length !== 1) {
    return logger.throwArgumentError("simulate log fail to match json", "keyword", keyword);
  }

  return results[0];
}

export function parseSimulateValue(log: string, key: string) {
  const reg = new RegExp(`"${key}":(\\d+)`, "g");

  const results = reg.exec(log);
  if (!results || results.length !== 2) {
    return logger.throwArgumentError("simulate log fail to match key", "key", key);
  }

  return results[1];
}
