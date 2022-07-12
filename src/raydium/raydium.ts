import { Connection, PublicKey } from "@solana/web3.js";
import { isEmpty, merge } from "lodash";

import { Api, ApiFarmPools, ApiLiquidityPools, ApiTokens } from "../api";
import { getTimestamp } from "../common";
import { Cluster } from "../solana";

import { RaydiumTokenInfo } from "./type";

export interface RaydiumLoadParams {
  /* ================= solana ================= */
  // solana web3 connection
  connection: Connection;
  // solana cluster/network/env
  cluster?: Cluster;
  // user public key
  user?: PublicKey;
  /* ================= api ================= */
  // if provide tokens, the api request will be skipped on call Raydium.load
  // apiTokensCache?: Tokens;
  // if provide liquidity pools, the api request will be skipped on call Raydium.load
  // apiLiquidityPoolsCache?: LiquidityPools;
  // if provide farm pools, the api request will be skipped on call Raydium.load
  // apiFarmPoolsCache?: FarmPools;
  // TODO ETAG
  // api request interval in ms, -1 means never request again, 0 means always use fresh data, default is 5 mins (5 * 60 * 1000)
  apiRequestInterval?: number;
  // api request timeout in ms, default is 10 secs (10 * 1000)
  apiRequestTimeout?: number;
}

export interface RaydiumApiBatchRequestParams {
  // api instance
  api: Api;
  apiTokensCache?: ApiTokens;
  apiLiquidityPoolsCache?: ApiLiquidityPools;
  apiFarmPoolsCache?: ApiFarmPools;
}

export type RaydiumConstructorParams = Required<RaydiumLoadParams> & Required<RaydiumApiBatchRequestParams>;

export class Raydium {
  public connection: Connection;
  public cluster: Cluster;
  public user: PublicKey | null;

  public api: Api;
  public apiCache: Map<
    Cluster,
    {
      tokens?: { fetched: number; data: ApiTokens };
      liquidityPools?: { fetched: number; data: ApiLiquidityPools };
      farmPools?: { fetched: number; data: ApiFarmPools };
    }
  >;

  constructor(config: RaydiumConstructorParams) {
    const { connection, cluster, user, api, apiTokensCache, apiLiquidityPoolsCache, apiFarmPoolsCache } = config;

    this.connection = connection;
    this.cluster = cluster;
    this.user = user;

    this.api = api;
    this.apiCache = new Map();

    // set api cache
    const now = getTimestamp();
    this.apiCache.set(cluster, {
      tokens: { fetched: now, data: apiTokensCache },
      liquidityPools: { fetched: now, data: apiLiquidityPoolsCache },
      farmPools: { fetched: now, data: apiFarmPoolsCache },
    });
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

    const api = new Api(cluster, apiRequestTimeout);

    const [tokens, liquidityPools, farmPools] = await this.apiBatchRequest({ api });

    return new Raydium({
      ...custom,
      ...{ api, apiTokensCache: tokens, apiLiquidityPoolsCache: liquidityPools, apiFarmPoolsCache: farmPools },
    });
  }

  static async apiBatchRequest(
    params: RaydiumApiBatchRequestParams,
  ): Promise<[ApiTokens, ApiLiquidityPools, ApiFarmPools]> {
    const { api, apiTokensCache, apiLiquidityPoolsCache, apiFarmPoolsCache } = params;

    const requests: (
      | (() => Promise<ApiTokens>)
      | (() => Promise<ApiLiquidityPools>)
      | (() => Promise<ApiFarmPools>)
    )[] = [
      // (): Promise<ApiTokens> => api.getTokens(),
      // (): Promise<ApiLiquidityPools> => api.getLiquidityPools(),
      // (): Promise<ApiFarmPools> => api.getFarmPools(),
    ];

    if (!apiTokensCache) {
      requests.push(() => api.getTokens());
    } else {
      requests.push(async () => apiTokensCache);
    }

    if (!apiLiquidityPoolsCache) {
      requests.push(() => api.getLiquidityPools());
    } else {
      requests.push(async () => apiLiquidityPoolsCache);
    }

    if (!apiFarmPoolsCache) {
      requests.push(() => api.getFarmPools());
    } else {
      requests.push(async () => apiFarmPoolsCache);
    }

    return (await Promise.all(requests.map((fn) => fn()))) as [ApiTokens, ApiLiquidityPools, ApiFarmPools];
  }
}
