import { Raydium } from "../raydium";
import { ApiFarmPools } from "../../api";

export default class Farms {
  public scope: Raydium | undefined = undefined;
  constructor(scope: Raydium) {
    this.scope = scope;
  }

  public getFarms(): ApiFarmPools | undefined {
    const data = this.scope?.apiCache.get(this.scope.cluster);
    return data?.farmPools?.data;
  }
}
