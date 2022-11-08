import axios, { AxiosInstance } from "axios";

import { createLogger, sleep } from "../common";
import { Cluster } from "../solana";

import { ApiFarmPools, ApiJsonPairInfo, ApiLiquidityPools, ApiTokens, ApiAmmV3PoolInfo } from "./type";

const logger = createLogger("Raydium_Api");

export async function endlessRetry<T>(name: string, call: () => Promise<T>, interval = 1000): Promise<T> {
  let result: T | undefined;

  while (result == undefined) {
    try {
      logger.debug(`Request ${name} through endlessRetry`);
      result = await call();
    } catch (err) {
      logger.error(`Request ${name} failed, retry after ${interval} ms`, err);
      await sleep(interval);
    }
  }

  return result;
}

export interface UrlConfigs {
  tokens?: string;
  liquidityPools?: string;
  pairs?: string;
  farms?: string;
  ammV3Pools?: string;
  price?: string;
}

export interface ApiProps {
  cluster: Cluster;
  timeout: number;
  urlConfigs?: UrlConfigs;
}

export class Api {
  public cluster: Cluster;

  public api: AxiosInstance;

  public urlConfigs: UrlConfigs;

  constructor({ cluster, timeout, urlConfigs }: ApiProps) {
    this.cluster = cluster;
    this.urlConfigs = urlConfigs || {};

    this.api = axios.create({ baseURL: "https://api.raydium.io/v2", timeout });

    this.api.interceptors.request.use(
      (config) => {
        // before request
        const { method, baseURL, url } = config;

        logger.debug(`${method?.toUpperCase()} ${baseURL}${url}`);

        return config;
      },
      (error) => {
        // request error
        logger.error(`Request failed`);

        return Promise.reject(error);
      },
    );
    this.api.interceptors.response.use(
      (response) => {
        // 2xx
        const { config, data, status } = response;
        const { method, baseURL, url } = config;

        logger.debug(`${method?.toUpperCase()} ${baseURL}${url}  ${status}`);

        return data;
      },
      (error) => {
        // https://axios-http.com/docs/handling_errors
        // not 2xx
        const { config, response = {} } = error;
        const { status } = response;
        const { method, baseURL, url } = config;

        logger.error(`${method.toUpperCase()} ${baseURL}${url} ${status || error.message}`);

        return Promise.reject(error);
      },
    );
  }

  async getTokens(): Promise<ApiTokens> {
    return this.api.get(this.urlConfigs.tokens || "/sdk/token/raydium.mainnet.json");
  }

  async getLiquidityPools(): Promise<ApiLiquidityPools> {
    return this.api.get(this.urlConfigs.liquidityPools || `/sdk/liquidity/${this.cluster}.json`);
  }

  async getPairsInfo(): Promise<ApiJsonPairInfo[]> {
    return this.api.get(this.urlConfigs.pairs || "/main/pairs");
  }

  async getFarmPools(): Promise<ApiFarmPools> {
    return this.api.get(this.urlConfigs.farms || `/sdk/farm-v2/${this.cluster}.json`);
  }

  async getConcentratedPools(): Promise<ApiAmmV3PoolInfo[]> {
    const res = await this.api.get(this.urlConfigs.ammV3Pools || "/ammV3/ammPools");
    return res.data;
  }

  async getCoingeckoPrice(coingeckoIds: string[]): Promise<Record<string, { usd?: number }>> {
    return this.api.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds.join(",")}&vs_currencies=usd`,
    );
  }

  async getRaydiumTokenPrice(): Promise<Record<string, number>> {
    return this.api.get(this.urlConfigs.price || "/main/price");
  }

  async getBlockSlotCountForSecond(endpointUrl?: string): Promise<number> {
    if (!endpointUrl) return 2;
    const res: {
      id: string;
      jsonrpc: string;
      result: { numSlots: number; numTransactions: number; samplePeriodSecs: number; slot: number }[];
    } = await this.api.post(endpointUrl, {
      id: "getRecentPerformanceSamples",
      jsonrpc: "2.0",
      method: "getRecentPerformanceSamples",
      params: [4],
    });
    const slotList = res.result.map((data) => data.numSlots);
    return slotList.reduce((a, b) => a + b, 0) / slotList.length / 60;
  }
}
