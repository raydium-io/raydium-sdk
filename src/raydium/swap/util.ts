import { PublicKey } from "@solana/web3.js";

import { findProgramAddress } from "../../common/txTool";
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

export async function getAssociatedMiddleStatusAccount({
  programId,
  fromPoolId,
  middleMint,
  owner,
}: {
  programId: PublicKey;
  fromPoolId: PublicKey;
  middleMint: PublicKey;
  owner: PublicKey;
}): Promise<PublicKey> {
  const { publicKey } = await findProgramAddress(
    [fromPoolId.toBuffer(), middleMint.toBuffer(), owner.toBuffer()],
    programId,
  );
  return publicKey;
}
