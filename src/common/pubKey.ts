import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AccountMeta, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

interface AccountMetaProps {
  pubkey: PublicKey;
  isSigner?: boolean;
  isWritable?: boolean;
}

export function accountMeta({ pubkey, isSigner = false, isWritable = false }: AccountMetaProps): AccountMeta {
  return {
    pubkey,
    isWritable,
    isSigner,
  };
}

export const commonSystemAccountMeta = [
  accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
  accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
  accountMeta({ pubkey: SYSVAR_RENT_PUBKEY, isWritable: false }),
];

export type PublicKeyish = PublicKey | string;

export function validateAndParsePublicKey(publicKey: PublicKeyish): PublicKey {
  if (publicKey instanceof PublicKey) {
    return publicKey;
  }

  if (typeof publicKey === "string") {
    try {
      const key = new PublicKey(publicKey);
      return key;
    } catch {
      throw new Error("invalid public key");
    }
  }

  throw new Error("invalid public key");
}
