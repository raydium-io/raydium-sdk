import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { findProgramAddress, METADATA_PROGRAM_ID } from "../../../common";

import { i32ToBytes, u16ToBytes } from "./util";

export const AMM_CONFIG_SEED = Buffer.from("amm_config", "utf8");
export const POOL_SEED = Buffer.from("pool", "utf8");
export const POOL_VAULT_SEED = Buffer.from("pool_vault", "utf8");
export const POOL_REWARD_VAULT_SEED = Buffer.from("pool_reward_vault", "utf8");
export const POSITION_SEED = Buffer.from("position", "utf8");
export const TICK_ARRAY_SEED = Buffer.from("tick_array", "utf8");

type ReturnType = Promise<{ publicKey: PublicKey; nonce: number }>;

export async function getPdaAmmConfigId(programId: PublicKey, index: number): ReturnType {
  const { publicKey, nonce } = await findProgramAddress([AMM_CONFIG_SEED, u16ToBytes(index)], programId);
  return { publicKey, nonce };
}

export async function getPdaPoolId(
  programId: PublicKey,
  ammConfigId: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey,
): ReturnType {
  const { publicKey, nonce } = await findProgramAddress(
    [POOL_SEED, ammConfigId.toBuffer(), mintA.toBuffer(), mintB.toBuffer()],
    programId,
  );
  return { publicKey, nonce };
}

export async function getPdaPoolVaultId(programId: PublicKey, poolId: PublicKey, vaultMint: PublicKey): ReturnType {
  const { publicKey, nonce } = await findProgramAddress(
    [POOL_VAULT_SEED, poolId.toBuffer(), vaultMint.toBuffer()],
    programId,
  );
  return { publicKey, nonce };
}

export async function getPdaPoolRewardVaulId(
  programId: PublicKey,
  poolId: PublicKey,
  rewardMint: PublicKey,
): ReturnType {
  const { publicKey, nonce } = await findProgramAddress(
    [POOL_REWARD_VAULT_SEED, poolId.toBuffer(), rewardMint.toBuffer()],
    programId,
  );
  return { publicKey, nonce };
}

export async function getPdaTickArrayAddress(programId: PublicKey, poolId: PublicKey, startIndex: number): ReturnType {
  const { publicKey, nonce } = await findProgramAddress(
    [TICK_ARRAY_SEED, poolId.toBuffer(), i32ToBytes(startIndex)],
    programId,
  );
  return { publicKey, nonce };
}

export async function getPdaProtocolPositionAddress(
  programId: PublicKey,
  poolId: PublicKey,
  tickLower: number,
  tickUpper: number,
): ReturnType {
  const { publicKey, nonce } = await findProgramAddress(
    [POSITION_SEED, poolId.toBuffer(), i32ToBytes(tickLower), i32ToBytes(tickUpper)],
    programId,
  );
  return { publicKey, nonce };
}

export async function getPdaPersonalPositionAddress(programId: PublicKey, nftMint: PublicKey): ReturnType {
  const { publicKey, nonce } = await findProgramAddress([POSITION_SEED, nftMint.toBuffer()], programId);
  return { publicKey, nonce };
}

export async function getATAAddress(owner: PublicKey, mint: PublicKey): ReturnType {
  const { publicKey, nonce } = await findProgramAddress(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  );
  return { publicKey, nonce };
}

export function getPdaMetadataKey(mint: PublicKey): ReturnType {
  return findProgramAddress(
    [Buffer.from("metadata", "utf8"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID,
  );
}
