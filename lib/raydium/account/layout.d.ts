import { Structure } from '../../marshmallow/index.js';
import * as BN from 'bn.js';
import * as _solana_web3_js from '@solana/web3.js';
import '../../marshmallow/buffer-layout.js';

declare const splAccountLayout: Structure<number | _solana_web3_js.PublicKey | BN, "", {
    mint: _solana_web3_js.PublicKey;
    owner: _solana_web3_js.PublicKey;
    amount: BN;
    delegateOption: number;
    delegate: _solana_web3_js.PublicKey;
    state: number;
    isNativeOption: number;
    isNative: BN;
    delegatedAmount: BN;
    closeAuthorityOption: number;
    closeAuthority: _solana_web3_js.PublicKey;
}>;

export { splAccountLayout };
