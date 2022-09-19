import { AccountInfo, RpcResponseAndContext, PublicKey } from '@solana/web3.js';
import { TokenAccount, TokenAccountRaw } from './types.js';
import 'bn.js';
import '../../bignumber-2daa5944.js';
import '../../module/token.js';
import '../../common/pubKey.js';
import '../token/type.js';
import '../../common/logger.js';
import '../../marshmallow/buffer-layout.js';
import './layout.js';
import '../../marshmallow/index.js';

interface ParseTokenAccount {
    solAccountResp?: AccountInfo<Buffer> | null;
    tokenAccountResp: RpcResponseAndContext<Array<{
        pubkey: PublicKey;
        account: AccountInfo<Buffer>;
    }>>;
}
declare function parseTokenAccountResp({ solAccountResp, tokenAccountResp }: ParseTokenAccount): {
    tokenAccounts: TokenAccount[];
    tokenAccountRawInfos: TokenAccountRaw[];
};

export { ParseTokenAccount, parseTokenAccountResp };
