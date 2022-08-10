import { ApiFarmPools } from "../../api";
import Module from "../module";
import { Raydium } from "../raydium";

export default class Farm extends Module {
  constructor(scope: Raydium) {
    super(scope);
  }

  public async init(): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchLiquidity();
    await this.scope.fetchFarms();
  }

  public getFarms(): ApiFarmPools | undefined {
    return this.scope.apiCache.farmPools?.data;
  }
}
