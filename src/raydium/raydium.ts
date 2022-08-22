import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { merge } from "lodash";
import { Logger } from "pino";

import { Api, ApiFarmPools, ApiLiquidityPools, ApiTokens } from "../api";
import { EMPTY_CONNECTION, EMPTY_OWNER } from "../common/error";
import { createLogger } from "../common/logger";
import { Owner } from "../common/owner";
import { PublicKeyish } from "../common/pubKey";
import { TokenAmount } from "../module/amount";
import { Token } from "../module/token";
import { Cluster } from "../solana";

import Account, { TokenAccountDataProp } from "./account/account";
import Farm from "./farm/farm";
import Liquidity from "./liquidity/liquidity";
import Route from "./route/route";
import TokenModule, { MintToTokenAmount } from "./token/token";
import Trade from "./trade/trade";
import { SignAllTransactions } from "./type";

export interface RaydiumLoadParams extends TokenAccountDataProp {
  /* ================= solana ================= */
  // solana web3 connection
  connection: Connection;
  // solana cluster/network/env
  cluster?: Cluster;
  // user public key
  owner?: PublicKey | Keypair;
  /* ================= api ================= */
  // if provide tokens, the api request will be skipped on call Raydium.load
  // defaultApiTokens?: Tokens;
  // if provide liquidity pools, the api request will be skipped on call Raydium.load
  // defaultApiLiquidityPools?: LiquidityPools;
  // if provide farm pools, the api request will be skipped on call Raydium.load
  // defaultApiFarmPools?: FarmPools;
  // api request interval in ms, -1 means never request again, 0 means always use fresh data, default is 5 mins (5 * 60 * 1000)
  apiRequestInterval?: number;
  // api request timeout in ms, default is 10 secs (10 * 1000)
  apiRequestTimeout?: number;
  signAllTransactions?: SignAllTransactions;
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
  public liquidity: Liquidity;
  public token: TokenModule;
  public trade: Trade;
  public route: Route;
  public rawBalances: Map<string, string> = new Map();
  public apiData: ApiData;

  private _connection: Connection;
  private _owner: Owner | undefined;
  private api: Api;
  private _signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  private logger: Logger;

  constructor(config: RaydiumConstructorParams) {
    const { connection, cluster, owner, api, defaultApiTokens, defaultApiLiquidityPools, defaultApiFarmPools } = config;

    this._connection = connection;
    this.cluster = cluster;
    this._owner = owner ? new Owner(owner) : undefined;
    this._signAllTransactions = config.signAllTransactions;

    this.api = api;
    this.logger = createLogger("Raydium");
    this.farm = new Farm({ scope: this, moduleName: "Raydium.Farm" });
    this.account = new Account({
      scope: this,
      moduleName: "Raydium.Account",
      tokenAccounts: config.tokenAccounts,
      tokenAccountRowInfos: config.tokenAccountRowInfos,
    });
    this.liquidity = new Liquidity({ scope: this, moduleName: "Raydium.Liquidity" });
    this.token = new TokenModule({ scope: this, moduleName: "Raydium.token" });
    this.trade = new Trade({ scope: this, moduleName: "Raydium.trade" });
    this.route = new Route({ scope: this, moduleName: "Raydium.route" });

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
        owner: null,
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

    await raydium.token.load();
    await raydium.liquidity.load();
    await raydium.farm.load();

    return raydium;
  }

  get owner(): Owner {
    if (!this._owner) throw new Error(EMPTY_OWNER);
    return this._owner;
  }
  get ownerPubKey(): PublicKey {
    if (!this._owner) throw new Error(EMPTY_OWNER);
    return this._owner.publicKey;
  }
  public setOwner(owner: PublicKey | Keypair): Raydium {
    this._owner = new Owner(owner);
    return this;
  }
  get connection(): Connection {
    if (!this._connection) throw new Error(EMPTY_CONNECTION);
    return this._connection;
  }
  public setConnection(connection: Connection): Raydium {
    this._connection = connection;
    return this;
  }

  get signAllTransactions(): SignAllTransactions | undefined {
    return this._signAllTransactions;
  }

  public checkOwner(): void {
    if (!this.owner) {
      this.logger.error(EMPTY_OWNER);
      throw new Error(EMPTY_OWNER);
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

  public mintToToken(mint: PublicKeyish): Token {
    return this.token.mintToToken(mint);
  }

  public mintToTokenAmount(params: MintToTokenAmount): TokenAmount {
    return this.token.mintToTokenAmount(params);
  }
}
