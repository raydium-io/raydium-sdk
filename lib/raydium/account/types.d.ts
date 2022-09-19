import { PublicKey } from '@solana/web3.js';
import BN__default from 'bn.js';
import { i as BigNumberish } from '../../bignumber-2daa5944.js';
import { GetStructureSchema } from '../../marshmallow/buffer-layout.js';
import { splAccountLayout } from './layout.js';
import '../../module/token.js';
import '../../common/pubKey.js';
import '../token/type.js';
import '../../common/logger.js';
import '../../marshmallow/index.js';

declare type SplAccountLayout = typeof splAccountLayout;
declare type SplAccount = GetStructureSchema<SplAccountLayout>;
interface TokenAccountRaw {
    pubkey: PublicKey;
    accountInfo: SplAccount;
}
interface TokenAccount {
    publicKey?: PublicKey;
    mint: PublicKey;
    isAssociated?: boolean;
    amount: BN__default;
    isNative: boolean;
}
interface getCreatedTokenAccountParams {
    mint: PublicKey;
    config?: {
        associatedOnly?: boolean;
    };
}
interface HandleTokenAccountParams {
    side: "in" | "out";
    amount: BigNumberish;
    mint: PublicKey;
    tokenAccount?: PublicKey;
    payer?: PublicKey;
    bypassAssociatedCheck: boolean;
    skipCloseAccount?: boolean;
}

export { HandleTokenAccountParams, SplAccount, SplAccountLayout, TokenAccount, TokenAccountRaw, getCreatedTokenAccountParams };
