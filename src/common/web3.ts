// import BN from 'bn.js';

// import { Spl, SPL_ACCOUNT_LAYOUT } from '../spl';
// import { TOKEN_PROGRAM_ID } from './id';

import {
  AccountInfo, AddressLookupTableAccount, Commitment, Connection, Keypair, PublicKey, Signer,
  SimulatedTransactionResponse, Transaction, TransactionInstruction,
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
export async function simulateMultipleInstruction(
  connection: Connection,
  instructions: TransactionInstruction[],
  keyword: string,
  batchRequest = true
) {
  const feePayer = new PublicKey("RaydiumSimuLateTransaction11111111111111111");

  const transactions: Transaction[] = [];

  let transaction = new Transaction();
  transaction.feePayer = feePayer

  for (const instruction of instructions) {
    if (!forecastTransactionSize([...transaction.instructions, instruction], [feePayer])) {
      transactions.push(transaction);
      transaction = new Transaction();
      transaction.feePayer = feePayer
    }
    transaction.add(instruction);
  }
  if (transaction.instructions.length > 0) {
    transactions.push(transaction);
  }

  let results: SimulatedTransactionResponse[] = [];

  try {
    results = await simulateTransaction(connection, transactions, batchRequest)
    if (results.find(i => i.err !== null)) throw Error('rpc simulateTransaction error')
  } catch (error) {
    if (error instanceof Error) {
      return logger.throwError("failed to simulate for instructions", Logger.errors.RPC_ERROR, {
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

export async function simulateTransaction(connection: Connection, transactions: Transaction[], batchRequest?: boolean) {
  let results: any[] = []
  if (batchRequest) {
    const getLatestBlockhash = await connection.getLatestBlockhash()

    const encodedTransactions: string[] = []
    for (const transaction of transactions) {
      transaction.recentBlockhash = getLatestBlockhash.blockhash
      transaction.lastValidBlockHeight = getLatestBlockhash.lastValidBlockHeight

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const message = transaction._compile();
      const signData = message.serialize();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const wireTransaction = transaction._serialize(signData);
      const encodedTransaction = wireTransaction.toString('base64');

      encodedTransactions.push(encodedTransaction)
    }

    const batch = encodedTransactions.map((keys) => {
      const args = connection._buildArgs([keys], undefined, "base64");
      return {
        methodName: "simulateTransaction",
        args,
      };
    });

    const reqData: { methodName: string; args: any[]; }[][] = []
    const itemReqIndex = 20
    for (let i = 0; i < Math.ceil(batch.length / itemReqIndex); i++) {
      reqData.push(batch.slice(i * itemReqIndex, (i + 1) * itemReqIndex))
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    results = await (await Promise.all(reqData.map(async (i) => (await connection._rpcBatchRequest(i)).map(ii => ii.result.value)))).flat()
  } else {
    try {
      results = (await Promise.all(
        transactions.map(async (transaction) =>
          await (await connection.simulateTransaction(transaction)).value
        )));
    } catch (error) {
      if (error instanceof Error) {
        return logger.throwError("failed to get info for multiple accounts", Logger.errors.RPC_ERROR, {
          message: error.message,
        });
      }
    }
  }

  return results
}

export function splitTxAndSigners({ instructions, signers, payer }: {
  instructions: TransactionInstruction[],
  signers: (Signer | Keypair)[],
  payer: PublicKey
}): {
  instruction: TransactionInstruction[];
  signer: (Keypair | Signer)[];
}[] {
  const signerKey: { [key: string]: Signer } = {}
  for (const item of signers) signerKey[item.publicKey.toString()] = item

  const transactions: { instruction: TransactionInstruction[], signer: (Keypair | Signer)[] }[] = []

  let itemIns: TransactionInstruction[] = []

  for (const item of instructions) {
    const _itemIns = [...itemIns, item]
    const _signerStrs = new Set<string>(_itemIns.map(i => i.keys.filter(ii => ii.isSigner).map(ii => ii.pubkey.toString())).flat())
    const _signer = [..._signerStrs.values()].map(i => new PublicKey(i))

    if (forecastTransactionSize(_itemIns, [payer, ..._signer])) {
      itemIns.push(item)
    } else {
      transactions.push({
        instruction: itemIns,
        signer: [..._signerStrs.values()].map(i => signerKey[i]).filter(i => i !== undefined)
      })

      itemIns = [item]
    }
  }

  if (itemIns.length > 0) {
    const _signerStrs = new Set<string>(itemIns.map(i => i.keys.filter(ii => ii.isSigner).map(ii => ii.pubkey.toString())).flat())
    transactions.push({
      instruction: itemIns,
      signer: [..._signerStrs.values()].map(i => signerKey[i]).filter(i => i !== undefined)
    })
  }

  return transactions
}

export async function getMultipleLookupTableInfo({ connection, address}: { connection: Connection, address: PublicKey[]}) {
  const dataInfos = await getMultipleAccountsInfo(connection, address)

  const outList: AddressLookupTableAccount[] = []
  for (let i = 0 ; i < address.length; i++) {
    const info = dataInfos[i]
    const key = address[i]
    if (!info) continue
    outList.push(new AddressLookupTableAccount({
      key,
      state: AddressLookupTableAccount.deserialize(info.data)
    }))
  }

  return outList
}