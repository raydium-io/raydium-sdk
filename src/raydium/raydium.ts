import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { merge } from "lodash";
import { Logger } from "pino";

import { Api, ApiFarmPools, ApiJsonPairInfo, ApiLiquidityPools, ApiTokens } from "../api";
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

export interface RaydiumLoadParams extends TokenAccountDataProp, Omit<RaydiumApiBatchRequestParams, "api"> {
  /* ================= solana ================= */
  // solana web3 connection
  connection: Connection;
  // solana cluster/network/env
  cluster?: Cluster;
  // user public key
  owner?: PublicKey | Keypair;
  /* ================= api ================= */
  // api request interval in ms, -1 means never request again, 0 means always use fresh data, default is 5 mins (5 * 60 * 1000)
  apiRequestInterval?: number;
  // api request timeout in ms, default is 10 secs (10 * 1000)
  apiRequestTimeout?: number;
  apiCacheTime?: number;
  signAllTransactions?: SignAllTransactions;
}

export interface RaydiumApiBatchRequestParams {
  api: Api;
  defaultApiTokens?: ApiTokens;
  defaultApiLiquidityPools?: ApiLiquidityPools;
  defaultApiFarmPools?: ApiFarmPools;
  defaultApiPairsInfo?: ApiJsonPairInfo[];
}

export type RaydiumConstructorParams = Required<RaydiumLoadParams> & RaydiumApiBatchRequestParams;

interface ApiData {
  tokens?: { fetched: number; data: ApiTokens };
  liquidityPools?: { fetched: number; data: ApiLiquidityPools };
  liquidityPairsInfo?: { fetched: number; data: ApiJsonPairInfo[] };
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
  public api: Api;
  private _apiCacheTime: number;
  private _signAllTransactions?: SignAllTransactions;
  private logger: Logger;

  constructor(config: RaydiumConstructorParams) {
    const {
      connection,
      cluster,
      owner,
      api,
      defaultApiTokens,
      defaultApiLiquidityPools,
      defaultApiFarmPools,
      defaultApiPairsInfo,
      apiCacheTime,
    } = config;

    this._connection = connection;
    this.cluster = cluster;
    this._owner = owner ? new Owner(owner) : undefined;
    this._signAllTransactions = config.signAllTransactions;

    this.api = api;
    this._apiCacheTime = apiCacheTime || 5 * 60 * 1000;
    this.logger = createLogger("Raydium");
    this.farm = new Farm({ scope: this, moduleName: "Raydium_Farm" });
    this.account = new Account({
      scope: this,
      moduleName: "Raydium_Account",
      tokenAccounts: config.tokenAccounts,
      tokenAccountRawInfos: config.tokenAccountRawInfos,
    });
    this.liquidity = new Liquidity({ scope: this, moduleName: "Raydium_Liquidity" });
    this.token = new TokenModule({ scope: this, moduleName: "Raydium_token" });
    this.trade = new Trade({ scope: this, moduleName: "Raydium_trade" });
    this.route = new Route({ scope: this, moduleName: "Raydium_route" });

    const now = new Date().getTime();

    const [apiTokensCache, apiLiquidityPoolsCache, apiFarmPoolsCache, apiLiquidityPairsInfoCache] = [
      defaultApiTokens ? { fetched: now, data: defaultApiTokens } : apiCacheData.tokens,
      defaultApiLiquidityPools ? { fetched: now, data: defaultApiLiquidityPools } : apiCacheData.liquidityPools,
      defaultApiFarmPools ? { fetched: now, data: defaultApiFarmPools } : apiCacheData.farmPools,
      defaultApiPairsInfo ? { fetched: now, data: defaultApiPairsInfo } : apiCacheData.liquidityPairsInfo,
    ];

    this.apiData = {
      ...(apiTokensCache ? { tokens: apiTokensCache } : {}),
      ...(apiLiquidityPoolsCache ? { liquidityPools: apiLiquidityPoolsCache } : {}),
      ...(apiFarmPoolsCache ? { farmPools: apiFarmPoolsCache } : {}),
      ...(apiLiquidityPairsInfoCache ? { liquidityPairsInfo: apiLiquidityPairsInfoCache } : {}),
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

    return raydium;
  }

  get owner(): Owner | undefined {
    return this._owner;
  }
  get ownerPubKey(): PublicKey {
    if (!this._owner) throw new Error(EMPTY_OWNER);
    return this._owner.publicKey;
  }
  public setOwner(owner?: PublicKey | Keypair): Raydium {
    this._owner = owner ? new Owner(owner) : undefined;
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
  public setSignAllTransactions(signAllTransactions?: SignAllTransactions): Raydium {
    this._signAllTransactions = signAllTransactions;
    return this;
  }

  public checkOwner(): void {
    if (!this.owner) {
      this.logger.error(EMPTY_OWNER);
      throw new Error(EMPTY_OWNER);
    }
  }

  private isCacheInvalidate(time: number): boolean {
    return new Date().getTime() - time > this._apiCacheTime;
  }

  public async fetchTokens(forceUpdate?: boolean): Promise<ApiTokens> {
    if (this.apiData.tokens && !this.isCacheInvalidate(this.apiData.tokens.fetched) && !forceUpdate)
      return this.apiData.tokens.data;
    const dataObject = {
      fetched: Date.now(),
      data: await this.api.getTokens(),
    };
    this.apiData.tokens = dataObject;
    apiCacheData.tokens = dataObject;

    return dataObject.data;
  }

  public async fetchLiquidity(forceUpdate?: boolean): Promise<ApiLiquidityPools> {
    if (this.apiData.liquidityPools && !this.isCacheInvalidate(this.apiData.liquidityPools.fetched) && !forceUpdate)
      return this.apiData.liquidityPools.data;
    const dataObject = {
      fetched: Date.now(),
      data: await this.api.getLiquidityPools(),
    };
    this.apiData.liquidityPools = dataObject;
    apiCacheData.liquidityPools = dataObject;
    return dataObject.data;
  }

  public async fetchPairs(forceUpdate?: boolean): Promise<ApiJsonPairInfo[]> {
    if (
      this.apiData.liquidityPairsInfo &&
      !this.isCacheInvalidate(this.apiData.liquidityPairsInfo.fetched) &&
      !forceUpdate
    )
      return this.apiData.liquidityPairsInfo?.data || [];
    const dataObject = {
      fetched: Date.now(),
      data: await this.api.getPairsInfo(),
    };
    this.apiData.liquidityPairsInfo = dataObject;
    apiCacheData.liquidityPairsInfo = dataObject;
    return dataObject.data;
  }

  public async fetchFarms(forceUpdate?: boolean): Promise<ApiFarmPools> {
    if (this.apiData.farmPools && !this.isCacheInvalidate(this.apiData.farmPools.fetched) && !forceUpdate)
      return this.apiData.farmPools.data;

    const dataObject = {
      fetched: Date.now(),
      data: await this.api.getFarmPools(),
    };
    this.apiData.farmPools = dataObject;
    apiCacheData.farmPools = dataObject;

    return dataObject.data;
  }

  public async chainTimeOffset(): Promise<number> {
    const chainTime = await this.connection.getBlockTime(await this.connection.getSlot());
    if (!chainTime) return 0;
    chainTime * 1000;
    const offset = Number((chainTime * 1000 - Date.now()).toFixed(0));
    return offset;
  }

  public mintToToken(mint: PublicKeyish): Token {
    return this.token.mintToToken(mint);
  }
  public mintToTokenAmount(params: MintToTokenAmount): TokenAmount {
    return this.token.mintToTokenAmount(params);
  }
  public decimalAmount(params: MintToTokenAmount): BN {
    return this.token.decimalAmount(params);
  }
  public uiAmount(params: MintToTokenAmount): string {
    return this.token.uiAmount(params);
  }
}
