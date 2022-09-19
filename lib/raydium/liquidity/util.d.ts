import { PublicKey, Connection } from '@solana/web3.js';
import { L as LiquidityVersion } from '../../type-9c271374.js';
import { PublicKeyish } from '../../common/pubKey.js';
import { T as TokenAmount } from '../../bignumber-2daa5944.js';
import { Token } from '../../module/token.js';
import { LiquidityStateLayout } from './layout.js';
import { LiquidityPoolKeys, AmountSide, LiquidityPoolInfo, LiquidityAssociatedPoolKeys, LiquidityFetchMultipleInfoParams } from './type.js';
import 'bn.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../token/type.js';
import '../account/types.js';
import '../account/layout.js';
import '../../common/logger.js';
import '../../common/accountInfo.js';

/**
 * Get token amount side of liquidity pool
 * @param amount - the token amount provided
 * @param poolKeys - the pool keys
 * @returns token amount side is `base` or `quote`
 */
declare function getAmountSide(amount: TokenAmount, poolKeys: LiquidityPoolKeys): AmountSide;
declare function includesToken(token: Token, poolKeys: LiquidityPoolKeys): boolean;
declare function getPoolEnabledFeatures(poolInfo: LiquidityPoolInfo): {
    swap: boolean;
    addLiquidity: boolean;
    removeLiquidity: boolean;
};
declare function getLiquidityStateLayout(version: number): LiquidityStateLayout;
declare function getLiquidityProgramId(version: number): PublicKey;
interface GetAssociatedParam {
    name: AssociatedName;
    programId: PublicKey;
    marketId: PublicKey;
}
declare type AssociatedName = "amm_associated_seed" | "lp_mint_associated_seed" | "coin_vault_associated_seed" | "pc_vault_associated_seed" | "lp_mint_associated_seed" | "temp_lp_token_associated_seed" | "open_order_associated_seed" | "target_associated_seed" | "withdraw_associated_seed";
declare function getLiquidityAssociatedId({ name, programId, marketId }: GetAssociatedParam): Promise<PublicKey>;
declare function getLiquidityAssociatedAuthority({ programId, }: {
    programId: PublicKey;
}): Promise<{
    publicKey: PublicKey;
    nonce: number;
}>;
declare function getAssociatedPoolKeys({ version, marketId: _marketId, baseMint: _baseMint, quoteMint: _quoteMint, }: {
    version: LiquidityVersion;
    marketId: PublicKeyish;
    baseMint: PublicKeyish;
    quoteMint: PublicKeyish;
}): Promise<LiquidityAssociatedPoolKeys>;
declare function makeSimulationPoolInfo({ connection, pools, }: LiquidityFetchMultipleInfoParams & {
    connection: Connection;
}): Promise<LiquidityPoolInfo[]>;
/**
 * Get currencies amount side of liquidity pool
 * @param amountA - the token amount provided
 * @param amountB - the token amount provided
 * @param poolKeys - the pool keys
 * @returns currencies amount side array
 */
declare function getAmountsSide(amountA: TokenAmount, amountB: TokenAmount, poolKeys: LiquidityPoolKeys): AmountSide[];
declare function getTokensSide(tokenA: Token, tokenB: Token, poolKeys: LiquidityPoolKeys): AmountSide[];
declare function getTokenSide(token: Token, poolKeys: LiquidityPoolKeys): AmountSide;
declare const isValidFixedSide: (val: string) => boolean;
declare function getLiquidityInfo(connection: Connection, poolId: PublicKey, dexProgramId: PublicKey): Promise<{
    baseAmount: number;
    quoteAmount: number;
    lpSupply: number;
    baseVaultKey: PublicKey;
    quoteVaultKey: PublicKey;
    baseVaultBalance: number | null;
    quoteVaultBalance: number | null;
    openOrdersKey: PublicKey;
    openOrdersTotalBase: number;
    openOrdersTotalQuote: number;
    basePnl: number;
    quotePnl: number;
    priceInQuote: number;
} | null>;

export { getAmountSide, getAmountsSide, getAssociatedPoolKeys, getLiquidityAssociatedAuthority, getLiquidityAssociatedId, getLiquidityInfo, getLiquidityProgramId, getLiquidityStateLayout, getPoolEnabledFeatures, getTokenSide, getTokensSide, includesToken, isValidFixedSide, makeSimulationPoolInfo };
