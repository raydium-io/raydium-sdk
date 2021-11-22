import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Logger } from "./logger";

const logger = new Logger("Common.Pubkey");

/* ================= global public keys ================= */
export { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
export { SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

export const SYSTEM_PROGRAM_ID = SystemProgram.programId;
export const MEMO_PROGRAM_ID = new PublicKey("Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo");

/* ================= validate public key ================= */
export type PublicKeyIsh = PublicKey | string;

export function validateAndParsePublicKey(publicKey: PublicKeyIsh) {
  if (publicKey instanceof PublicKey) {
    return publicKey;
  }

  if (typeof publicKey === "string") {
    try {
      const key = new PublicKey(publicKey);
      return key;
    } catch {
      return logger.throwArgumentError("invalid public key", "publicKey", publicKey);
    }
  }

  return logger.throwArgumentError("invalid public key", "publicKey", publicKey);
}

export async function findProgramAddress(seeds: Array<Buffer | Uint8Array>, programId: PublicKey) {
  const [publicKey, nonce] = await PublicKey.findProgramAddress(seeds, programId);
  return { publicKey, nonce };
}

export function AccountMeta(publicKey: PublicKey, isSigner: boolean) {
  return {
    pubkey: publicKey,
    isWritable: true,
    isSigner,
  };
}

export function AccountMetaReadonly(publicKey: PublicKey, isSigner: boolean) {
  return {
    pubkey: publicKey,
    isWritable: false,
    isSigner,
  };
}
