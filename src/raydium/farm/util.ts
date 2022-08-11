import { PublicKey } from "@solana/web3.js";

import { FARM_VERSION_TO_PROGRAMID } from "./constant";

interface ProgramAddress {
  publicKey: PublicKey;
  nonce: number;
}

export async function findProgramAddress(
  seeds: Array<Buffer | Uint8Array>,
  programId: PublicKey,
): Promise<ProgramAddress> {
  const [publicKey, nonce] = await PublicKey.findProgramAddress(seeds, programId);
  return { publicKey, nonce };
}

interface AssociatedLedgerPoolAccount {
  programId: PublicKey;
  poolId: PublicKey;
  mint: PublicKey;
  type: "lpVault" | "rewardVault";
}

export async function getAssociatedLedgerPoolAccount({
  programId,
  poolId,
  mint,
  type,
}: AssociatedLedgerPoolAccount): Promise<PublicKey> {
  const { publicKey } = await findProgramAddress(
    [
      poolId.toBuffer(),
      mint.toBuffer(),
      Buffer.from(
        type === "lpVault" ? "lp_vault_associated_seed" : type === "rewardVault" ? "reward_vault_associated_seed" : "",
        "utf-8",
      ),
    ],
    programId,
  );
  return publicKey;
}

export const getAssociatedAuthority = async ({
  programId,
  poolId,
}: {
  programId: PublicKey;
  poolId: PublicKey;
}): Promise<ProgramAddress> => await findProgramAddress([poolId.toBuffer()], programId);

export function getFarmProgramId(version: number): PublicKey | undefined {
  const programId = FARM_VERSION_TO_PROGRAMID[version];

  return programId;
}
