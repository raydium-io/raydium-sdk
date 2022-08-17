import { AmmSource } from "../liquidity/type";

export function groupPools(pools: AmmSource[]): AmmSource[][] {
  const grouped: AmmSource[][] = [];

  for (let index = 0; index < pools.length; index++) {
    for (let i = 0; i < pools.length; i++) {
      if (index == i) continue;
      grouped.push([pools[index], pools[i]]);
    }
  }
  return grouped;
}
