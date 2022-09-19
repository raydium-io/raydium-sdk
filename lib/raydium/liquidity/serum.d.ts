import { PublicKey } from '@solana/web3.js';
import { S as SerumVersion } from '../../type-bcca4bc0.js';
import 'bn.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../../bignumber-2daa5944.js';
import '../../module/token.js';
import '../../common/pubKey.js';
import '../token/type.js';
import '../../common/logger.js';
import '../account/types.js';
import '../account/layout.js';

declare const _SERUM_PROGRAM_ID_V3 = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
declare const SERUM_PROGRAM_ID_V3: PublicKey;
declare const SERUM_PROGRAMID_TO_VERSION: {
    [key: string]: SerumVersion;
};
declare const SERUM_VERSION_TO_PROGRAM_ID: {
    [key in SerumVersion]?: PublicKey;
} & {
    [K: number]: PublicKey;
};
declare function getSerumVersion(version: number): SerumVersion;
declare function getSerumProgramId(version: number): PublicKey;
declare function getSerumAssociatedAuthority({ programId, marketId, }: {
    programId: PublicKey;
    marketId: PublicKey;
}): Promise<{
    publicKey: PublicKey;
    nonce: number;
}>;

export { SERUM_PROGRAMID_TO_VERSION, SERUM_PROGRAM_ID_V3, SERUM_VERSION_TO_PROGRAM_ID, _SERUM_PROGRAM_ID_V3, getSerumAssociatedAuthority, getSerumProgramId, getSerumVersion };
