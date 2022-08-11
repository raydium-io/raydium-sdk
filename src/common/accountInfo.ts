import { AccountInfo, Commitment, Connection, PublicKey } from "@solana/web3.js";

import { chunkArray } from "./lodash";
import { createLogger } from "./logger";

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

const logger = createLogger("Raydium.accountInfo.util");

export async function getMultipleAccountsInfo(
  connection: Connection,
  publicKeys: PublicKey[],
  config?: GetMultipleAccountsInfoConfig,
): Promise<(AccountInfo<Buffer> | null)[]> {
  const { batchRequest, commitment } = {
    batchRequest: false,
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
        logger.error(`failed to get info for multiple accounts, RPC_ERROR, ${unsafeRes.error.message}`);
        throw new Error("failed to get info for multiple accounts");
      }

      return unsafeRes.result.value.map((accountInfo) => {
        if (accountInfo) {
          const { data, executable, lamports, owner, rentEpoch } = accountInfo;

          if (data.length !== 2 && data[1] !== "base64") {
            logger.error(`info must be base64 encoded, RPC_ERROR`);
            throw new Error("info must be base64 encoded");
          }

          return {
            data: Buffer.from(data[0], "base64"),
            executable,
            lamports,
            owner: new PublicKey(owner),
            rentEpoch,
          };
        }
        return null;
      });
    });
  } else {
    try {
      results = (await Promise.all(
        chunkedKeys.map((keys) => connection.getMultipleAccountsInfo(keys, commitment)),
      )) as (AccountInfo<Buffer> | null)[][];
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`failed to get info for multiple accounts, RPC_ERROR, ${error.message}`);
        throw new Error("failed to get info for multiple accounts");
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
