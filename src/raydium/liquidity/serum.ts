import { PublicKey } from "@solana/web3.js";

import { SerumVersion } from "../../api";
import { createLogger } from "../../common/logger";

import { LIQUIDITY_VERSION_TO_SERUM_VERSION } from "./constant";

const logger = createLogger("Raydium_liquidity_serum");

/* ================= program public keys ================= */
export const _SERUM_PROGRAM_ID_V3 = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
export const SERUM_PROGRAM_ID_V3 = new PublicKey(_SERUM_PROGRAM_ID_V3);

// serum program id string => serum version
export const SERUM_PROGRAMID_TO_VERSION: {
  [key: string]: SerumVersion;
} = {
  [_SERUM_PROGRAM_ID_V3]: 3,
};

// serum version => serum program id
export const SERUM_VERSION_TO_PROGRAM_ID: { [key in SerumVersion]?: PublicKey } & {
  [K: number]: PublicKey;
} = {
  3: SERUM_PROGRAM_ID_V3,
};

export function getSerumVersion(version: number): SerumVersion {
  const serumVersion = LIQUIDITY_VERSION_TO_SERUM_VERSION[version];
  if (!serumVersion) logger.logWithError("invalid version", "version", version);

  return serumVersion;
}

export function getSerumProgramId(version: number): PublicKey {
  const programId = SERUM_VERSION_TO_PROGRAM_ID[version];
  if (!programId) logger.logWithError("invalid version", "version", version);

  return programId;
}

export async function getSerumAssociatedAuthority({
  programId,
  marketId,
}: {
  programId: PublicKey;
  marketId: PublicKey;
}): Promise<{ publicKey: PublicKey; nonce: number }> {
  const seeds = [marketId.toBuffer()];

  let nonce = 0;
  let publicKey: PublicKey;

  while (nonce < 100) {
    try {
      const seedsWithNonce = seeds.concat(Buffer.from([nonce]), Buffer.alloc(7));
      publicKey = await PublicKey.createProgramAddress(seedsWithNonce, programId);
    } catch (err) {
      if (err instanceof TypeError) {
        throw err;
      }
      nonce++;
      continue;
    }
    return { publicKey, nonce };
  }

  logger.logWithError("unable to find a viable program address nonce", "params", {
    programId,
    marketId,
  });
  throw new Error("unable to find a viable program address nonce");
}
