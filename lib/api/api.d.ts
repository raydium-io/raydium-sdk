import { AxiosInstance } from 'axios';
import { Cluster } from '../solana/type.js';
import { b as ApiTokens, d as ApiLiquidityPools, e as ApiJsonPairInfo, h as ApiFarmPools } from '../type-bcca4bc0.js';
import '@solana/web3.js';
import 'bn.js';
import '../marshmallow/index.js';
import '../marshmallow/buffer-layout.js';
import '../bignumber-2daa5944.js';
import '../module/token.js';
import '../common/pubKey.js';
import '../raydium/token/type.js';
import '../common/logger.js';
import '../raydium/account/types.js';
import '../raydium/account/layout.js';

declare function endlessRetry<T>(name: string, call: () => Promise<T>, interval?: number): Promise<T>;
interface ApiProps {
    cluster: Cluster;
    timeout: number;
}
declare class Api {
    cluster: Cluster;
    api: AxiosInstance;
    constructor({ cluster, timeout }: ApiProps);
    getTokens(): Promise<ApiTokens>;
    getLiquidityPools(): Promise<ApiLiquidityPools>;
    getPairsInfo(): Promise<ApiJsonPairInfo[]>;
    getFarmPools(): Promise<ApiFarmPools>;
    getCoingeckoPrice(coingeckoIds: string[]): Promise<Record<string, {
        usd?: number;
    }>>;
    getRaydiumTokenPrice(): Promise<Record<string, number>>;
    getBlockSlotCountForSecond(endpointUrl?: string): Promise<number>;
}

export { Api, ApiProps, endlessRetry };
