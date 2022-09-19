import { PublicKey } from '@solana/web3.js';
import BN__default from 'bn.js';
import { c as ApiLiquidityPoolInfo, e as ApiJsonPairInfo, ay as ReplaceType, L as LiquidityVersion } from '../../type-9c271374.js';
import { GetMultipleAccountsInfoConfig } from '../../common/accountInfo.js';
import { T as TokenAmount, P as Percent, w as Price, i as BigNumberish } from '../../bignumber-2daa5944.js';
import { PublicKeyish } from '../../common/pubKey.js';
import { Token } from '../../module/token.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../token/type.js';
import '../account/types.js';
import '../account/layout.js';
import '../../common/logger.js';

declare type LiquidityPoolJsonInfo = ApiLiquidityPoolInfo;
declare type PairJsonInfo = ApiJsonPairInfo;
declare type LiquidityPoolKeysV4 = {
    [T in keyof LiquidityPoolJsonInfo]: string extends LiquidityPoolJsonInfo[T] ? PublicKey : LiquidityPoolJsonInfo[T];
};
declare type LiquiditySide = "a" | "b";
declare type SwapSide = "in" | "out";
declare type AmountSide = "base" | "quote";
/**
 * Full liquidity pool keys that build transaction need
 */
declare type LiquidityPoolKeys = LiquidityPoolKeysV4;
interface LiquidityPoolInfo {
    status: BN__default;
    baseDecimals: number;
    quoteDecimals: number;
    lpDecimals: number;
    baseReserve: BN__default;
    quoteReserve: BN__default;
    lpSupply: BN__default;
    startTime: BN__default;
}
declare type SDKParsedLiquidityInfo = ReplaceType<LiquidityPoolJsonInfo, string, PublicKey> & {
    jsonInfo: LiquidityPoolJsonInfo;
    status: BN__default;
    baseDecimals: number;
    quoteDecimals: number;
    lpDecimals: number;
    baseReserve: BN__default;
    quoteReserve: BN__default;
    lpSupply: BN__default;
    startTime: BN__default;
};
interface AmmSource {
    poolKeys: LiquidityPoolKeys;
    poolInfo: LiquidityPoolInfo;
}
interface SerumSource {
    marketKeys: [];
    bids: [];
    asks: [];
}
interface LiquidityFetchMultipleInfoParams {
    pools: LiquidityPoolKeys[];
    config?: GetMultipleAccountsInfoConfig;
}
interface LiquidityComputeAmountOutParams {
    poolKeys: LiquidityPoolKeys;
    poolInfo: LiquidityPoolInfo;
    amountIn: TokenAmount;
    outputToken: Token;
    slippage: Percent;
}
declare type LiquidityComputeAmountOutReturn = {
    amountOut: TokenAmount;
    minAmountOut: TokenAmount;
    currentPrice: Price;
    executionPrice: Price | null;
    priceImpact: Percent;
    fee: TokenAmount;
};
interface LiquiditySwapTransactionParams {
    poolKeys: LiquidityPoolKeys;
    payer?: PublicKey;
    amountIn: TokenAmount;
    amountOut: TokenAmount;
    fixedSide: SwapSide;
    config?: {
        bypassAssociatedCheck?: boolean;
    };
}
interface LiquiditySwapFixedOutInstructionParamsV4 {
    poolKeys: LiquidityPoolKeys;
    userKeys: {
        tokenAccountIn: PublicKey;
        tokenAccountOut: PublicKey;
        owner: PublicKey;
    };
    maxAmountIn: BigNumberish;
    amountOut: BigNumberish;
}
/**
 * Swap instruction params
 */
interface LiquiditySwapInstructionParams {
    poolKeys: LiquidityPoolKeys;
    userKeys: {
        tokenAccountIn: PublicKey;
        tokenAccountOut: PublicKey;
        owner: PublicKey;
    };
    amountIn: BigNumberish;
    amountOut: BigNumberish;
    fixedSide: SwapSide;
}
interface LiquiditySwapFixedInInstructionParamsV4 {
    poolKeys: LiquidityPoolKeys;
    userKeys: {
        tokenAccountIn: PublicKey;
        tokenAccountOut: PublicKey;
        owner: PublicKey;
    };
    amountIn: BigNumberish;
    minAmountOut: BigNumberish;
}
interface LiquidityAssociatedPoolKeysV4 extends Omit<LiquidityPoolKeysV4, "marketBaseVault" | "marketQuoteVault" | "marketBids" | "marketAsks" | "marketEventQueue" | "baseDecimals" | "quoteDecimals" | "lpDecimals"> {
    nonce: number;
}
/**
 * Associated liquidity pool keys
 * @remarks
 * without partial markets keys
 */
declare type LiquidityAssociatedPoolKeys = LiquidityAssociatedPoolKeysV4;
interface CreatePoolParam {
    version: LiquidityVersion;
    baseMint: PublicKeyish;
    quoteMint: PublicKeyish;
    marketId: PublicKeyish;
}
interface InitPoolParam extends CreatePoolParam {
    baseAmount: TokenAmount;
    quoteAmount: TokenAmount;
    startTime?: BigNumberish;
    config?: {
        bypassAssociatedCheck?: boolean;
    };
}
declare type LiquidityInitPoolInstructionParams = {
    poolKeys: LiquidityAssociatedPoolKeysV4;
    userKeys: {
        lpTokenAccount: PublicKey;
        payer: PublicKey;
    };
    startTime: BigNumberish;
};
/**
 * Add liquidity transaction params
 */
interface LiquidityAddTransactionParams {
    poolId: PublicKeyish;
    payer?: PublicKey;
    amountInA: TokenAmount;
    amountInB: TokenAmount;
    fixedSide: LiquiditySide;
    config?: {
        bypassAssociatedCheck?: boolean;
    };
}
/**
 * Full user keys that build transaction need
 */
interface LiquidityUserKeys {
    baseTokenAccount: PublicKey;
    quoteTokenAccount: PublicKey;
    lpTokenAccount: PublicKey;
    owner: PublicKey;
}
interface LiquidityAddInstructionParamsV4 {
    poolKeys: LiquidityPoolKeys;
    userKeys: LiquidityUserKeys;
    baseAmountIn: BigNumberish;
    quoteAmountIn: BigNumberish;
    fixedSide: AmountSide;
}
/**
 * Add liquidity instruction params
 */
declare type LiquidityAddInstructionParams = LiquidityAddInstructionParamsV4;
interface LiquidityRemoveInstructionParamsV4 {
    poolKeys: LiquidityPoolKeys;
    userKeys: LiquidityUserKeys;
    amountIn: BigNumberish;
}
interface LiquidityRemoveTransactionParams {
    poolId: PublicKeyish;
    payer?: PublicKey;
    amountIn: TokenAmount;
    config?: {
        bypassAssociatedCheck?: boolean;
    };
}
/**
 * Remove liquidity instruction params
 */
declare type LiquidityRemoveInstructionParams = LiquidityRemoveInstructionParamsV4;
interface LiquidityComputeAnotherAmountParams {
    poolId: PublicKeyish;
    amount: TokenAmount;
    anotherToken: Token;
    slippage: Percent;
}

export { AmmSource, AmountSide, CreatePoolParam, InitPoolParam, LiquidityAddInstructionParams, LiquidityAddInstructionParamsV4, LiquidityAddTransactionParams, LiquidityAssociatedPoolKeys, LiquidityAssociatedPoolKeysV4, LiquidityComputeAmountOutParams, LiquidityComputeAmountOutReturn, LiquidityComputeAnotherAmountParams, LiquidityFetchMultipleInfoParams, LiquidityInitPoolInstructionParams, LiquidityPoolInfo, LiquidityPoolJsonInfo, LiquidityPoolKeys, LiquidityPoolKeysV4, LiquidityRemoveInstructionParams, LiquidityRemoveInstructionParamsV4, LiquidityRemoveTransactionParams, LiquiditySide, LiquiditySwapFixedInInstructionParamsV4, LiquiditySwapFixedOutInstructionParamsV4, LiquiditySwapInstructionParams, LiquiditySwapTransactionParams, LiquidityUserKeys, PairJsonInfo, SDKParsedLiquidityInfo, SerumSource, SwapSide };
