import { ApiLiquidityPoolInfo } from "../../api";
import Module, { ModuleProps } from "../module";

export default class Liqudity extends Module {
  constructor(params: ModuleProps) {
    super(params);
  }

  public async init(): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchLiquidity();
  }

  public getAllPools(): ApiLiquidityPoolInfo[] {
    this.checkDisabled();
    if (!this.scope.apiData.liquidityPools) return [];
    const { data } = this.scope.apiData.liquidityPools;
    return [...(data.official ?? []), ...(data.unOfficial ?? [])];
  }
}
