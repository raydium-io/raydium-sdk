import { PublicKey } from "@solana/web3.js";

import { findProgramAddress } from "../../common/txTool";

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
