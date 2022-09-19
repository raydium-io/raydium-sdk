import { PublicKey } from '@solana/web3.js';
import { i as BigNumberish, P as Percent, T as TokenAmount, w as Price } from '../../bignumber-2daa5944.js';
import { Currency } from '../../module/currency.js';
import { Token } from '../../module/token.js';
import { LiquidityPoolKeys, LiquidityPoolJsonInfo, SerumSource, SwapSide } from '../liquidity/type.js';
import 'bn.js';
import '../token/type.js';
import '../../common/pubKey.js';
import '../../common/logger.js';
import '../../type-9c271374.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../account/types.js';
import '../account/layout.js';
import '../../common/accountInfo.js';

declare type TradeSource = "amm" | "serum" | "stable";
declare type RouteType = "amm" | "serum" | "route";
interface RouteInfo {
    source: TradeSource;
    keys: LiquidityPoolKeys;
}
interface GetBestAmountOutParams {
    pools?: LiquidityPoolJsonInfo[];
    markets?: SerumSource[];
    inputToken: Token;
    outputToken: Token;
    amountIn: BigNumberish;
    slippage: Percent;
    midTokens?: Currency | Token[];
    features?: RouteType[];
}
interface GetAmountOutReturn {
    routes: RouteInfo[];
    routeType: "amm" | "route";
    amountOut: TokenAmount;
    minAmountOut: TokenAmount;
    fixedSide: "in";
    currentPrice: Price | null;
    executionPrice: Price | null;
    priceImpact: Percent;
    fee: TokenAmount[];
}
interface SwapParams {
    payer?: PublicKey;
    amountIn: TokenAmount;
    amountOut: TokenAmount;
    fixedSide: SwapSide;
    slippage: Percent;
    config?: {
        bypassAssociatedCheck?: boolean;
    };
}
interface CustomSwapParams {
    routes: RouteInfo[];
    routeType: RouteType;
    payer?: PublicKey;
    amountIn: TokenAmount;
    amountOut: TokenAmount;
    fixedSide: SwapSide;
    config?: {
        bypassAssociatedCheck?: boolean;
    };
}
interface AvailableSwapPools {
    availablePools: LiquidityPoolJsonInfo[];
    best?: LiquidityPoolJsonInfo;
    routedPools: LiquidityPoolJsonInfo[];
}
interface SwapExtInfo {
    extInfo: {
        amountOut: TokenAmount;
    };
}

export { AvailableSwapPools, CustomSwapParams, GetAmountOutReturn, GetBestAmountOutParams, RouteInfo, RouteType, SwapExtInfo, SwapParams, TradeSource };
