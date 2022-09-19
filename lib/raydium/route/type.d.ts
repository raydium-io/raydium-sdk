import { PublicKey } from '@solana/web3.js';
import { T as TokenAmount, P as Percent, w as Price, F as Fraction, i as BigNumberish } from '../../bignumber-2daa5944.js';
import { Token } from '../../module/token.js';
import { LiquidityPoolKeys, LiquidityPoolInfo, SwapSide } from '../liquidity/type.js';
import 'bn.js';
import '../token/type.js';
import '../../common/logger.js';
import '../../common/pubKey.js';
import '../../type-bcca4bc0.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../account/types.js';
import '../account/layout.js';
import '../../common/accountInfo.js';

interface RouteComputeAmountOutParams {
    fromPoolKeys: LiquidityPoolKeys;
    toPoolKeys: LiquidityPoolKeys;
    fromPoolInfo: LiquidityPoolInfo;
    toPoolInfo: LiquidityPoolInfo;
    amountIn: TokenAmount;
    outputToken: Token;
    slippage: Percent;
}
interface RouteComputeAmountOutData {
    amountOut: TokenAmount;
    minAmountOut: TokenAmount;
    executionPrice: Price | null;
    priceImpact: Fraction;
    fee: TokenAmount[];
}
interface RouteSwapTransactionParams {
    fromPoolKeys: LiquidityPoolKeys;
    toPoolKeys: LiquidityPoolKeys;
    amountIn: TokenAmount;
    amountOut: TokenAmount;
    fixedSide: SwapSide;
    config?: {
        bypassAssociatedCheck?: boolean;
    };
}
interface RouteUserKeys {
    inTokenAccount: PublicKey;
    outTokenAccount: PublicKey;
    middleTokenAccount: PublicKey;
    middleStatusAccount: PublicKey;
    owner: PublicKey;
}
interface RouteSwapInFixedInInstructionParams {
    fromPoolKeys: LiquidityPoolKeys;
    toPoolKeys: LiquidityPoolKeys;
    userKeys: Omit<RouteUserKeys, "outTokenAccount">;
    amountIn: BigNumberish;
    amountOut: BigNumberish;
}
interface RouteSwapInstructionParams {
    fromPoolKeys: LiquidityPoolKeys;
    toPoolKeys: LiquidityPoolKeys;
    userKeys: RouteUserKeys;
    amountIn: BigNumberish;
    amountOut: BigNumberish;
    fixedSide: SwapSide;
}
interface RouteSwapOutFixedInInstructionParams {
    fromPoolKeys: LiquidityPoolKeys;
    toPoolKeys: LiquidityPoolKeys;
    userKeys: Omit<RouteUserKeys, "inTokenAccount">;
}

export { RouteComputeAmountOutData, RouteComputeAmountOutParams, RouteSwapInFixedInInstructionParams, RouteSwapInstructionParams, RouteSwapOutFixedInInstructionParams, RouteSwapTransactionParams, RouteUserKeys };
