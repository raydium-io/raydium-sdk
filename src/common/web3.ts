// import BN from 'bn.js';

// import { Spl, SPL_ACCOUNT_LAYOUT } from '../spl';
// import { TOKEN_PROGRAM_ID } from './id';

import { AccountInfo, Commitment, Connection, PublicKey } from "@solana/web3.js";
import { chunkArray } from "./lodash";
import { Logger } from "./logger";

const logger = new Logger("Common");

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

export async function getMultipleAccountsInfo(
  connection: Connection,
  publicKeys: PublicKey[],
  config?: GetMultipleAccountsInfoConfig,
): Promise<(AccountInfo<Buffer> | null)[]> {
  const defaultConfig = {
    batchRequest: false,
  };
  const customConfig = { ...defaultConfig, ...config };

  const chunkedKeys = chunkArray(publicKeys, 100);
  let results: (AccountInfo<Buffer> | null)[][] = new Array(chunkedKeys.length).fill([]);

  if (customConfig.batchRequest) {
    const batch = chunkedKeys.map((keys) => {
      const args = connection._buildArgs([keys.map((key) => key.toBase58())], customConfig.commitment, "base64");
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
      results = await Promise.all(
        chunkedKeys.map((keys) => connection.getMultipleAccountsInfo(keys, customConfig.commitment)),
      );
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

export async function getMultipleAccountsInfoWithCustomFlag<T extends { pubkey: PublicKey }>(
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
//       return logger.throwArgumentError('invalid token account layout length', 'publicKey', pubkey.toBase58());
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

export class Simulate {
  public static readonly PAYER = new PublicKey(Buffer.alloc(32));

  public static readonly BLOCK_HASH = new PublicKey(Buffer.alloc(32));

  static parseLogs(logs: string[], key: string) {
    const log = logs.find((l) => l.includes(key));
    if (!log) {
      return logger.throwArgumentError("no any log match key", "key", key);
    }

    const result = log.match(/{["\w:,]+}/g);
    if (!result) {
      return logger.throwArgumentError("match log not json format", "key", key);
    }

    return result;
  }
}
