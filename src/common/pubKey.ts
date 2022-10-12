import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AccountMeta, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

interface AccountMetaProps {
  pubkey: PublicKey;
  isSigner?: boolean;
  isWritable?: boolean;
}

export function accountMeta({ pubkey, isSigner = false, isWritable = true }: AccountMetaProps): AccountMeta {
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

export function validateAndParsePublicKey({
  publicKey,
  transformSol,
}: {
  publicKey: PublicKeyish;
  transformSol?: boolean;
}): PublicKey {
  if (publicKey instanceof PublicKey) {
    if (transformSol && publicKey.equals(SOLMint)) return WSOLMint;
    return publicKey;
  }

  if (transformSol && publicKey === SOLMint.toBase58()) return WSOLMint;

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

export function tryParsePublicKey(v: string): PublicKey | string {
  try {
    return new PublicKey(v);
  } catch (e) {
    return v;
  }
}

export const MEMO_PROGRAM_ID = new PublicKey("Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo");
export const RENT_PROGRAM_ID = new PublicKey("SysvarRent111111111111111111111111111111111");
export const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export const RAYMint = new PublicKey("4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R");
export const PAIMint = new PublicKey("Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS");
export const SRMMint = new PublicKey("SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt");
export const USDCMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const USDTMint = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
export const mSOLMint = new PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So");
export const stSOLMint = new PublicKey("7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj");
export const USDHMint = new PublicKey("USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX");
export const NRVMint = new PublicKey("NRVwhjBQiUPYtfDT5zRBVJajzFQHaBUNtC7SNVvqRFa");
export const ANAMint = new PublicKey("ANAxByE6G2WjFp7A4NqtWYXb3mgruyzZYg3spfxe6Lbo");
export const ETHMint = new PublicKey("7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs");
export const WSOLMint = new PublicKey("So11111111111111111111111111111111111111112");
export const SOLMint = PublicKey.default;
