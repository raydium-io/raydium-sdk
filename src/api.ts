import axios, { AxiosInstance } from "axios";

import { createLogger } from "./utility";

const logger = createLogger("Utility:Api");

export class Api {
  public _api: AxiosInstance;

  constructor() {
    this._api = axios.create({ baseURL: "https://api.raydium.io" });

    this._api.interceptors.request.use(
      (config) => {
        // before request
        const { method, url } = config;
        logger.debug(`${method?.toUpperCase()} ${url}`);

        return config;
      },
      (error) => {
        // request error
        logger.error(`Request failed`);

        return Promise.reject(error);
      },
    );
    this._api.interceptors.response.use(
      (response) => {
        // 2xx
        return response;
      },
      (error) => {
        // not 2xx
        const { config, response } = error;
        const { status } = response;
        const { method, url } = config;

        logger.debug(`${method.toUpperCase()} ${url} ${status}`);

        return Promise.reject(error);
      },
    );
  }

  async getTokens() {
    this._api.get("/");
  }
}
