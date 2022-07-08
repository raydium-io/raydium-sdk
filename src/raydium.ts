import { Connection, PublicKey } from "@solana/web3.js";
import { merge } from "lodash";

import { Api, FarmPools, LiquidityPools, Tokens } from "./api";
import { getTimestamp } from "./common";
import { Cluster } from "./solana";

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

export interface RaydiumConstructorParams extends Required<RaydiumLoadParams> {
  /* ================= api ================= */
  // api instance
  api: Api;
  apiTokensCache: Tokens;
  apiLiquidityPoolsCache: LiquidityPools;
  apiFarmPoolsCache: FarmPools;
}

export class Raydium {
  public connection: Connection;
  public cluster: Cluster;
  public user: PublicKey | null;

  public api: Api;
  public apiCache: Map<
    Cluster,
    {
      tokens?: { fetched: number; data: Tokens };
      liquidityPools?: { fetched: number; data: LiquidityPools };
      farmPools?: { fetched: number; data: FarmPools };
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

    const apiRequests: ((() => Promise<Tokens>) | (() => Promise<LiquidityPools>) | (() => Promise<FarmPools>))[] = [
      (): Promise<Tokens> => api.getTokens(),
      (): Promise<LiquidityPools> => api.getLiquidityPools(),
      (): Promise<FarmPools> => api.getFarmPools(),
    ];
    // if (!apiTokensCache) {
    //   apiRequests.push(() => api.getTokens());
    // } else {
    //   apiRequests.push(async () => apiTokensCache);
    // }
    // if (!apiLiquidityPoolsCache) {
    //   apiRequests.push(() => api.getLiquidityPools());
    // } else {
    //   apiRequests.push(async () => apiLiquidityPoolsCache);
    // }
    // if (!apiFarmPoolsCache) {
    //   apiRequests.push(() => api.getFarmPools());
    // } else {
    //   apiRequests.push(async () => apiFarmPoolsCache);
    // }

    const [tokens, liquidityPools, farmPools] = (await Promise.all(apiRequests.map((fn) => fn()))) as [
      Tokens,
      LiquidityPools,
      FarmPools,
    ];

    return new Raydium({
      ...custom,
      ...{ api, apiTokensCache: tokens, apiLiquidityPoolsCache: liquidityPools, apiFarmPoolsCache: farmPools },
    });
  }
}
