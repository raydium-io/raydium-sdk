import { Structure } from '../../marshmallow/index.js';
import * as BN from 'bn.js';
import * as _solana_web3_js from '@solana/web3.js';
import '../../marshmallow/buffer-layout.js';

declare const SPL_MINT_LAYOUT: Structure<number | _solana_web3_js.PublicKey | BN, "", {
    decimals: number;
    mintAuthorityOption: number;
    mintAuthority: _solana_web3_js.PublicKey;
    supply: BN;
    isInitialized: number;
    freezeAuthorityOption: number;
    freezeAuthority: _solana_web3_js.PublicKey;
}>;
declare type SplMintLayout = typeof SPL_MINT_LAYOUT;

export { SPL_MINT_LAYOUT, SplMintLayout };
