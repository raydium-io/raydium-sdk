import { Connection } from '@solana/web3.js';
import { PublicKeyish } from '../../common/pubKey.js';
import { GetStructureSchema } from '../../marshmallow/buffer-layout.js';
import { SPL_MINT_LAYOUT } from './layout.js';
import { TokenJson } from './type.js';
import '../../marshmallow/index.js';
import 'bn.js';
import '../../module/token.js';

declare function sortTokens(tokens: TokenJson[], mintList: {
    official: string[];
    unOfficial: string[];
}): TokenJson[];
declare function getSPLTokenInfo(connection: Connection, mintish: PublicKeyish): Promise<GetStructureSchema<typeof SPL_MINT_LAYOUT> | undefined>;

export { getSPLTokenInfo, sortTokens };
