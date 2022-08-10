import { ApiFarmPools } from "../../api";
import Module from "../module";
import { Raydium } from "../raydium";

export default class Liqudity extends Module {
  constructor(scope: Raydium) {
    super(scope);
  }

  public async init(): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchLiquidity();
  }

  public getFarms(): ApiFarmPools | undefined {
    this.checkDisabled();
    return this.scope.apiCache.farmPools?.data;
  }
}
