import { AccountMeta, PublicKey } from '@solana/web3.js';

interface AccountMetaProps {
    pubkey: PublicKey;
    isSigner?: boolean;
    isWritable?: boolean;
}
declare function accountMeta({ pubkey, isSigner, isWritable }: AccountMetaProps): AccountMeta;
declare const commonSystemAccountMeta: AccountMeta[];
declare type PublicKeyish = PublicKey | string;
declare function validateAndParsePublicKey({ publicKey, transformSol, }: {
    publicKey: PublicKeyish;
    transformSol?: boolean;
}): PublicKey;
declare function tryParsePublicKey(v: string): PublicKey | string;
declare const RAYMint: PublicKey;
declare const PAIMint: PublicKey;
declare const SRMMint: PublicKey;
declare const USDCMint: PublicKey;
declare const USDTMint: PublicKey;
declare const mSOLMint: PublicKey;
declare const stSOLMint: PublicKey;
declare const USDHMint: PublicKey;
declare const NRVMint: PublicKey;
declare const ANAMint: PublicKey;
declare const ETHMint: PublicKey;
declare const WSOLMint: PublicKey;
declare const SOLMint: PublicKey;

export { ANAMint, ETHMint, NRVMint, PAIMint, PublicKeyish, RAYMint, SOLMint, SRMMint, USDCMint, USDHMint, USDTMint, WSOLMint, accountMeta, commonSystemAccountMeta, mSOLMint, stSOLMint, tryParsePublicKey, validateAndParsePublicKey };
