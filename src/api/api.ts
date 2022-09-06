import axios, { AxiosInstance } from "axios";

import { createLogger, sleep } from "../common";
import { Cluster } from "../solana";

import { ApiFarmPools, ApiJsonPairInfo, ApiLiquidityPools, ApiTokens } from "./type";

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

export interface ApiProps {
  cluster: Cluster;
  timeout: number;
}

export class Api {
  public cluster: Cluster;

  public api: AxiosInstance;

  constructor({ cluster, timeout }: ApiProps) {
    this.cluster = cluster;

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
    return this.api.get(`/sdk/token/raydium.mainnet.json`);
  }

  async getLiquidityPools(): Promise<ApiLiquidityPools> {
    return this.api.get(`/sdk/liquidity/${this.cluster}.json`);
  }

  async getPairsInfo(): Promise<ApiJsonPairInfo[]> {
    return this.api.get("https://api.raydium.io/v2/main/pairs");
  }

  async getFarmPools(): Promise<ApiFarmPools> {
    return this.api.get(`/sdk/farm-v2/${this.cluster}.json`);
  }
}
