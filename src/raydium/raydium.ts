import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Signer, Transaction } from "@solana/web3.js";
import { merge } from "lodash";
import { Logger } from "pino";

import { Api, ApiFarmPools, ApiLiquidityPools, ApiTokens } from "../api";
import { createLogger } from "../common/logger";
import { Owner } from "../common/owner";
import { Cluster } from "../solana";

import Account, { DefaultAccountProp } from "./account";
import Farm from "./farm";
import Liquidity from "./liquidity";

export interface RaydiumLoadParams extends DefaultAccountProp {
  /* ================= solana ================= */
  // solana web3 connection
  connection: Connection;
  // solana cluster/network/env
  cluster?: Cluster;
  // user public key
  user?: PublicKey | Keypair;
  /* ================= api ================= */
  // if provide tokens, the api request will be skipped on call Raydium.load
  // defaultApiTokens?: Tokens;
  // if provide liquidity pools, the api request will be skipped on call Raydium.load
  // defaultApiLiquidityPools?: LiquidityPools;
  // if provide farm pools, the api request will be skipped on call Raydium.load
  // defaultApiFarmPools?: FarmPools;
  // TODO ETAG
  // api request interval in ms, -1 means never request again, 0 means always use fresh data, default is 5 mins (5 * 60 * 1000)
  apiRequestInterval?: number;
  // api request timeout in ms, default is 10 secs (10 * 1000)
  apiRequestTimeout?: number;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
}

export interface RaydiumApiBatchRequestParams {
  api: Api;
  defaultApiTokens?: ApiTokens;
  defaultApiLiquidityPools?: ApiLiquidityPools;
  defaultApiFarmPools?: ApiFarmPools;
}

export type RaydiumConstructorParams = Required<RaydiumLoadParams> & RaydiumApiBatchRequestParams;

interface ApiData {
  tokens?: { fetched: number; data: ApiTokens };
  liquidityPools?: { fetched: number; data: ApiLiquidityPools };
  farmPools?: { fetched: number; data: ApiFarmPools };
}

const apiCacheData: ApiData = {};
export class Raydium {
  public cluster: Cluster;
  public farm: Farm;
  public account: Account;
  public liqudity: Liquidity;
  public rawBalances: Map<string, string> = new Map();
  public apiData: ApiData;

  private _connection: Connection;
  private _owner: Owner | undefined;
  private api: Api;
  private _signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  private logger: Logger;

  constructor(config: RaydiumConstructorParams) {
    const { connection, cluster, user, api, defaultApiTokens, defaultApiLiquidityPools, defaultApiFarmPools } = config;

    this._connection = connection;
    this.cluster = cluster;
    this._owner = new Owner(user);
    this._signAllTransactions = config.signAllTransactions;

    this.api = api;
    this.logger = createLogger("Raydium");
    this.farm = new Farm({ scope: this, moduleName: "Raydium.Farm" });
    this.account = new Account({
      scope: this,
      moduleName: "Raydium.Account",
      defaultTokenAccounts: config.defaultTokenAccounts,
      defaultTokenAccountRowInfos: config.defaultTokenAccountRowInfos,
    });
    this.liqudity = new Liquidity({ scope: this, moduleName: "Raydium.Liquidity" });

    const now = new Date().getTime();

    const [apiTokensCache, apiLiquidityPoolsCache, apiFarmPoolsCache] = [
      defaultApiTokens ? { fetched: now, data: defaultApiTokens } : apiCacheData.tokens,
      defaultApiLiquidityPools ? { fetched: now, data: defaultApiLiquidityPools } : apiCacheData.liquidityPools,
      defaultApiFarmPools ? { fetched: now, data: defaultApiFarmPools } : apiCacheData.farmPools,
    ];

    this.apiData = {
      ...(apiTokensCache ? { tokens: apiTokensCache } : {}),
      ...(apiLiquidityPoolsCache ? { liquidityPools: apiLiquidityPoolsCache } : {}),
      ...(apiFarmPoolsCache ? { farmPools: apiFarmPoolsCache } : {}),
    };
  }

  static async load(config: RaydiumLoadParams): Promise<Raydium> {
    const custom: Required<RaydiumLoadParams> = merge(
      // default
      {
        cluster: "mainnet",
        user: null,
        apiRequestInterval: 5 * 60 * 1000,
        apiRequestTimeout: 10 * 1000,
      },
      config,
    );
    const { cluster, apiRequestTimeout } = custom;

    const api = new Api({ cluster, timeout: apiRequestTimeout });
    const raydium = new Raydium({
      ...custom,
      api,
    });

    await raydium.fetchTokens();

    return raydium;
  }

  get owner(): Owner {
    if (!this._owner) throw new Error("please connect wallet first");
    return this._owner;
  }

  get connection(): Connection {
    if (!this._connection) throw new Error("please provide connection");
    return this._connection;
  }

  get signAllTransactions(): ((transactions: Transaction[]) => Promise<Transaction[]>) | undefined {
    return this._signAllTransactions;
  }

  public updateConfig(params: Pick<RaydiumLoadParams, "connection" | "user">): void {
    Object.keys(params).map((key) => {
      this[`_${key}`] = params[key];
    });
  }

  public checkowner(): void {
    if (!this.owner) {
      this.logger.error("please provide wallet address");
      throw new Error("please provide wallet address");
    }
  }

  public async fetchTokens(forceUpdate?: boolean): Promise<ApiTokens> {
    if (this.apiData.tokens && !forceUpdate) return this.apiData.tokens.data;
    const dataObject = {
      fetched: Date.now(),
      data: await this.api.getTokens(),
    };
    this.apiData.tokens = dataObject;
    apiCacheData.tokens = dataObject;

    return dataObject.data;
  }

  public async fetchLiquidity(forceUpdate?: boolean): Promise<ApiLiquidityPools> {
    if (this.apiData.liquidityPools && !forceUpdate) return this.apiData.liquidityPools.data;
    const dataObject = {
      fetched: Date.now(),
      data: await this.api.getLiquidityPools(),
    };
    this.apiData.liquidityPools = dataObject;
    apiCacheData.liquidityPools = dataObject;
    return dataObject.data;
  }

  public async fetchFarms(forceUpdate?: boolean): Promise<ApiFarmPools> {
    if (this.apiData.farmPools && !forceUpdate) return this.apiData.farmPools.data;
    const dataObject = {
      fetched: Date.now(),
      data: await this.api.getFarmPools(),
    };
    this.apiData.farmPools = dataObject;
    apiCacheData.farmPools = dataObject;

    return dataObject.data;
  }

  public async buildTx(tx: Transaction, signers?: Signer[]): Promise<string> {
    if (this.signAllTransactions) {
      const txxx = await this.signAllTransactions!([tx]);
      return this.connection.sendRawTransaction(txxx[0].serialize());
    }
    if (signers?.length) return sendAndConfirmTransaction(this.connection, tx, signers);

    throw new Error("no wallet connected");
  }
}
