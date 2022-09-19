import { PublicKey } from '@solana/web3.js';
import BN__default from 'bn.js';
import { L as LiquidityVersion, S as SerumVersion } from '../../type-9c271374.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../../bignumber-2daa5944.js';
import '../../module/token.js';
import '../../common/pubKey.js';
import '../token/type.js';
import '../../common/logger.js';
import '../account/types.js';
import '../account/layout.js';

declare enum LiquidityPoolStatus {
    Uninitialized = 0,
    Initialized = 1,
    Disabled = 2,
    RemoveLiquidityOnly = 3,
    LiquidityOnly = 4,
    OrderBook = 5,
    Swap = 6,
    WaitingForStart = 7
}
declare const LIQUIDITY_FEES_NUMERATOR: BN__default;
declare const LIQUIDITY_FEES_DENOMINATOR: BN__default;
declare const _LIQUIDITY_PROGRAM_ID_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
declare const LIQUIDITY_PROGRAM_ID_V4: PublicKey;
declare const _LIQUIDITY_PROGRAM_ID_V5 = "5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h";
declare const LIQUIDITY_PROGRAM_ID_V5: PublicKey;
declare const LIQUIDITY_PROGRAMID_TO_VERSION: {
    [key: string]: LiquidityVersion;
};
declare const LIQUIDITY_VERSION_TO_PROGRAM_ID: {
    [key in LiquidityVersion]?: PublicKey;
} & {
    [K: number]: PublicKey;
};
declare const LIQUIDITY_VERSION_TO_SERUM_VERSION: {
    [key in LiquidityVersion]?: SerumVersion;
} & {
    [K: number]: SerumVersion;
};

export { LIQUIDITY_FEES_DENOMINATOR, LIQUIDITY_FEES_NUMERATOR, LIQUIDITY_PROGRAMID_TO_VERSION, LIQUIDITY_PROGRAM_ID_V4, LIQUIDITY_PROGRAM_ID_V5, LIQUIDITY_VERSION_TO_PROGRAM_ID, LIQUIDITY_VERSION_TO_SERUM_VERSION, LiquidityPoolStatus, _LIQUIDITY_PROGRAM_ID_V4, _LIQUIDITY_PROGRAM_ID_V5 };
