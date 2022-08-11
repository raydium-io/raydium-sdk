import { ApiLiquidityPoolInfo } from "../../api";
import Module, { ModuleProps } from "../module";

export default class Liquidity extends Module {
  public _poolInfos: ApiLiquidityPoolInfo[] = [];
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
    if (this._poolInfos.length) return this._poolInfos;

    const { data } = this.scope.apiData.liquidityPools;
    this._poolInfos = [...(data.official ?? []), ...(data.unOfficial ?? [])];
    return this._poolInfos;
  }
}
