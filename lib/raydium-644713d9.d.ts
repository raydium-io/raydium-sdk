import { PublicKey, Commitment, Connection, Keypair } from '@solana/web3.js';
import BN__default from 'bn.js';
import { Api } from './api/api.js';
import { ax as LoadParams, aa as HydratedFarmInfo, $ as FarmPoolJsonInfo, a8 as SdkParsedFarmInfo, a4 as CreateFarm, av as MakeTransaction, a5 as UpdateFarmReward, a6 as FarmDWParam, e as ApiJsonPairInfo, aw as MakeMultiTransaction, au as SignAllTransactions, b as ApiTokens, d as ApiLiquidityPools, h as ApiFarmPools } from './type-bcca4bc0.js';
import { Owner } from './common/owner.js';
import { PublicKeyish } from './common/pubKey.js';
import { i as BigNumberish, w as Price, T as TokenAmount, N as Numberish } from './bignumber-2daa5944.js';
import { Token } from './module/token.js';
import { Cluster } from './solana/type.js';
import { TxBuilder, AddInstructionParam } from './common/txTool.js';
import { Logger } from './common/logger.js';
import { SwapExtInfo, AvailableSwapPools, GetBestAmountOutParams, GetAmountOutReturn, SwapParams, CustomSwapParams } from './raydium/trade/type.js';
import { LiquidityPoolJsonInfo, PairJsonInfo, LiquidityFetchMultipleInfoParams, LiquidityPoolInfo, SDKParsedLiquidityInfo, LiquidityComputeAmountOutParams, LiquidityComputeAmountOutReturn, LiquidityComputeAnotherAmountParams, LiquiditySwapTransactionParams, CreatePoolParam, InitPoolParam, LiquidityAddTransactionParams, LiquidityRemoveTransactionParams, LiquiditySide } from './raydium/liquidity/type.js';
import { RouteComputeAmountOutParams, RouteComputeAmountOutData, RouteSwapTransactionParams } from './raydium/route/type.js';
import { TokenJson, SplToken } from './raydium/token/type.js';
import { TokenAccount, TokenAccountRaw, HandleTokenAccountParams } from './raydium/account/types.js';

interface ModuleBaseProps {
    scope: Raydium;
    moduleName: string;
}
declare class ModuleBase {
    scope: Raydium;
    private disabled;
    protected logger: Logger;
    constructor({ scope, moduleName }: ModuleBaseProps);
    protected createTxBuilder(feePayer?: PublicKey): TxBuilder;
    logDebug(...args: (string | number | Record<string, any>)[]): void;
    logInfo(...args: (string | number | Record<string, any>)[]): void;
    logAndCreateError(...args: (string | number | Record<string, any>)[]): void;
    checkDisabled(): void;
}

interface TokenAccountDataProp {
    tokenAccounts?: TokenAccount[];
    tokenAccountRawInfos?: TokenAccountRaw[];
}
declare class Account extends ModuleBase {
    private _tokenAccounts;
    private _tokenAccountRawInfos;
    private _ataCache;
    private _accountChangeListenerId?;
    private _accountListener;
    private _clientOwnedToken;
    constructor(params: TokenAccountDataProp & ModuleBaseProps);
    get tokenAccounts(): TokenAccount[];
    get tokenAccountRawInfos(): TokenAccountRaw[];
    updateTokenAccount({ tokenAccounts, tokenAccountRawInfos }: TokenAccountDataProp): Account;
    addAccountChangeListener(cbk: (data: TokenAccountDataProp) => void): Account;
    removeAccountChangeListener(cbk: (data: TokenAccountDataProp) => void): Account;
    getAssociatedTokenAccount(mint: PublicKey): Promise<PublicKey>;
    fetchWalletTokenAccounts(config?: {
        forceUpdate?: boolean;
        commitment?: Commitment;
    }): Promise<{
        tokenAccounts: TokenAccount[];
        tokenAccountRawInfos: TokenAccountRaw[];
    }>;
    getCreatedTokenAccount({ mint, associatedOnly, }: {
        mint: PublicKey;
        associatedOnly?: boolean;
    }): Promise<PublicKey | undefined>;
    checkOrCreateAta({ mint, autoUnwrapWSOLToSOL, }: {
        mint: PublicKey;
        autoUnwrapWSOLToSOL?: boolean;
    }): Promise<{
        pubKey: PublicKey;
        newInstructions: AddInstructionParam;
    }>;
    handleTokenAccount(params: HandleTokenAccountParams): Promise<AddInstructionParam & {
        tokenAccount: PublicKey;
    }>;
}

declare class Farm extends ModuleBase {
    private _farmPools;
    private _hydratedFarmPools;
    private _hydratedFarmMap;
    private _sdkParsedFarmPools;
    private _lpTokenInfoMap;
    load(params?: LoadParams): Promise<void>;
    fetchSdkFarmInfo(): Promise<void>;
    loadHydratedFarmInfo(params?: LoadParams & {
        skipPrice?: boolean;
    }): Promise<HydratedFarmInfo[]>;
    get allFarms(): FarmPoolJsonInfo[];
    get allParsedFarms(): SdkParsedFarmInfo[];
    get allHydratedFarms(): HydratedFarmInfo[];
    get allHydratedFarmMap(): Map<string, HydratedFarmInfo>;
    getFarm(farmId: PublicKeyish): FarmPoolJsonInfo;
    getParsedFarm(farmId: PublicKeyish): SdkParsedFarmInfo;
    getLpTokenInfo(lpMint: PublicKeyish): Token;
    lpDecimalAmount({ mint, amount }: {
        mint: PublicKeyish;
        amount: BigNumberish;
    }): BN__default;
    hydrateFarmInfo(params: {
        farmInfo: SdkParsedFarmInfo;
        blockSlotCountForSecond: number;
        farmAprs: Record<string, {
            apr30d: number;
            apr7d: number;
            apr24h: number;
        }>;
        currentBlockChainDate: Date;
        chainTimeOffset: number;
    }): HydratedFarmInfo;
    private _getUserRewardInfo;
    create({ poolId, rewardInfos, payer }: CreateFarm): Promise<MakeTransaction>;
    restartReward({ farmId, payer, newRewardInfo }: UpdateFarmReward): Promise<MakeTransaction>;
    addNewRewardToken(params: UpdateFarmReward): Promise<MakeTransaction>;
    private _prepareFarmAccounts;
    deposit(params: FarmDWParam): Promise<MakeTransaction>;
    withdraw(params: FarmDWParam): Promise<MakeTransaction>;
    withdrawFarmReward({ farmId, withdrawMint, }: {
        farmId: PublicKey;
        withdrawMint: PublicKey;
        payer?: PublicKey;
    }): Promise<MakeTransaction>;
}

declare class Liquidity extends ModuleBase {
    private _poolInfos;
    private _poolInfoMap;
    private _pairsInfo;
    private _pairsInfoMap;
    private _lpTokenMap;
    private _lpPriceMap;
    private _officialIds;
    private _unOfficialIds;
    private _sdkParseInfoCache;
    private _stableLayout;
    constructor(params: ModuleBaseProps);
    load(params?: LoadParams): Promise<void>;
    loadPairs(params?: LoadParams): Promise<ApiJsonPairInfo[]>;
    get allPools(): LiquidityPoolJsonInfo[];
    get allPoolIdSet(): {
        official: Set<string>;
        unOfficial: Set<string>;
    };
    get allPoolMap(): Map<string, LiquidityPoolJsonInfo>;
    get allPairs(): PairJsonInfo[];
    get allPairsMap(): Map<string, PairJsonInfo>;
    get lpTokenMap(): Map<string, Token>;
    get lpPriceMap(): Map<string, Price>;
    fetchMultipleInfo(params: LiquidityFetchMultipleInfoParams): Promise<LiquidityPoolInfo[]>;
    sdkParseJsonLiquidityInfo(liquidityJsonInfos: LiquidityPoolJsonInfo[]): Promise<SDKParsedLiquidityInfo[]>;
    computeAmountOut({ poolKeys, poolInfo, amountIn, outputToken, slippage, }: LiquidityComputeAmountOutParams): LiquidityComputeAmountOutReturn;
    /**
     * Compute the another currency amount of add liquidity
     *
     * @param params - {@link LiquidityComputeAnotherAmountParams}
     *
     * @returns
     * anotherAmount - token amount without slippage
     * @returns
     * maxAnotherAmount - token amount with slippage
     *
     * @example
     * ```
     * Liquidity.computeAnotherAmount({
     *   // 1%
     *   slippage: new Percent(1, 100)
     * })
     * ```
     */
    computePairAmount({ poolId, amount, anotherToken, slippage, }: LiquidityComputeAnotherAmountParams): Promise<{
        anotherAmount: TokenAmount;
        maxAnotherAmount: TokenAmount;
    }>;
    swapWithAMM(params: LiquiditySwapTransactionParams): Promise<MakeMultiTransaction & SwapExtInfo>;
    createPool(params: CreatePoolParam): Promise<MakeTransaction>;
    initPool(params: InitPoolParam): Promise<MakeTransaction>;
    addLiquidity(params: LiquidityAddTransactionParams): Promise<MakeTransaction>;
    removeLiquidity(params: LiquidityRemoveTransactionParams): Promise<MakeTransaction>;
    lpMintToTokenAmount({ poolId, amount, decimalDone, }: {
        poolId: PublicKeyish;
        amount: Numberish;
        decimalDone?: boolean;
    }): TokenAmount;
    getFixedSide({ poolId, inputMint }: {
        poolId: PublicKeyish;
        inputMint: PublicKeyish;
    }): LiquiditySide;
}

declare class Route extends ModuleBase {
    constructor(params: ModuleBaseProps);
    computeRouteAmountOut({ fromPoolKeys, toPoolKeys, fromPoolInfo, toPoolInfo, amountIn, outputToken, slippage, }: RouteComputeAmountOutParams): RouteComputeAmountOutData;
    swapWithRoute(params: RouteSwapTransactionParams): Promise<MakeMultiTransaction & SwapExtInfo>;
}

interface MintToTokenAmount {
    mint: PublicKeyish;
    amount: BigNumberish;
    decimalDone?: boolean;
}
declare class TokenModule extends ModuleBase {
    private _tokens;
    private _tokenMap;
    private _tokenPrice;
    private _mintList;
    constructor(params: ModuleBaseProps);
    load(params?: LoadParams): Promise<void>;
    get allTokens(): TokenJson[];
    get allTokenMap(): Map<string, SplToken>;
    get tokenMints(): {
        official: string[];
        unOfficial: string[];
    };
    get tokenPrices(): Map<string, Price>;
    fetchTokenPrices(preloadRaydiumPrice?: Record<string, number>): Promise<Map<string, Price>>;
    mintToToken(mint: PublicKeyish): Token;
    mintToTokenAmount({ mint, amount, decimalDone }: MintToTokenAmount): TokenAmount;
    decimalAmount({ mint, amount }: MintToTokenAmount): BN__default;
    uiAmount({ mint, amount }: MintToTokenAmount): string;
}

declare class Trade extends ModuleBase {
    load(): Promise<void>;
    private _getBestSwapPool;
    getAvailablePools(params: {
        inputMint: PublicKeyish;
        outputMint: PublicKeyish;
    }): Promise<AvailableSwapPools>;
    /**
     * Get best amount out
     *
     * @param pools - pools to calculate best swap rate, if not passed, will find automatically - optional
     */
    getBestAmountOut({ pools, amountIn, inputToken, outputToken, slippage, features, }: GetBestAmountOutParams): Promise<GetAmountOutReturn>;
    directSwap(params: SwapParams): Promise<MakeMultiTransaction & SwapExtInfo>;
    swap(params: CustomSwapParams): Promise<MakeMultiTransaction & SwapExtInfo>;
    private getWSolAccounts;
    unWrapWSol(amount: BigNumberish): Promise<MakeTransaction>;
    wrapWSol(amount: BigNumberish): Promise<MakeTransaction>;
}

interface RaydiumLoadParams extends TokenAccountDataProp, Omit<RaydiumApiBatchRequestParams, "api"> {
    connection: Connection;
    cluster?: Cluster;
    owner?: PublicKey | Keypair;
    apiRequestInterval?: number;
    apiRequestTimeout?: number;
    apiCacheTime?: number;
    signAllTransactions?: SignAllTransactions;
}
interface RaydiumApiBatchRequestParams {
    api: Api;
    defaultApiTokens?: ApiTokens;
    defaultApiLiquidityPools?: ApiLiquidityPools;
    defaultApiFarmPools?: ApiFarmPools;
    defaultApiPairsInfo?: ApiJsonPairInfo[];
}
declare type RaydiumConstructorParams = Required<RaydiumLoadParams> & RaydiumApiBatchRequestParams;
interface ApiData {
    tokens?: {
        fetched: number;
        data: ApiTokens;
    };
    liquidityPools?: {
        fetched: number;
        data: ApiLiquidityPools;
    };
    liquidityPairsInfo?: {
        fetched: number;
        data: ApiJsonPairInfo[];
    };
    farmPools?: {
        fetched: number;
        data: ApiFarmPools;
    };
}
declare class Raydium {
    cluster: Cluster;
    farm: Farm;
    account: Account;
    liquidity: Liquidity;
    token: TokenModule;
    trade: Trade;
    route: Route;
    rawBalances: Map<string, string>;
    apiData: ApiData;
    private _connection;
    private _owner;
    api: Api;
    private _apiCacheTime;
    private _signAllTransactions?;
    private logger;
    constructor(config: RaydiumConstructorParams);
    static load(config: RaydiumLoadParams): Promise<Raydium>;
    get owner(): Owner | undefined;
    get ownerPubKey(): PublicKey;
    setOwner(owner?: PublicKey | Keypair): Raydium;
    get connection(): Connection;
    setConnection(connection: Connection): Raydium;
    get signAllTransactions(): SignAllTransactions | undefined;
    setSignAllTransactions(signAllTransactions?: SignAllTransactions): Raydium;
    checkOwner(): void;
    private isCacheInvalidate;
    fetchTokens(forceUpdate?: boolean): Promise<ApiTokens>;
    fetchLiquidity(forceUpdate?: boolean): Promise<ApiLiquidityPools>;
    fetchPairs(forceUpdate?: boolean): Promise<ApiJsonPairInfo[]>;
    fetchFarms(forceUpdate?: boolean): Promise<ApiFarmPools>;
    chainTimeOffset(): Promise<number>;
    mintToToken(mint: PublicKeyish): Token;
    mintToTokenAmount(params: MintToTokenAmount): TokenAmount;
    decimalAmount(params: MintToTokenAmount): BN__default;
    uiAmount(params: MintToTokenAmount): string;
}

export { Account as A, Farm as F, Liquidity as L, ModuleBase as M, RaydiumLoadParams as R, TokenAccountDataProp as T, RaydiumApiBatchRequestParams as a, RaydiumConstructorParams as b, Raydium as c, ModuleBaseProps as d, Route as e, TokenModule as f, MintToTokenAmount as g, Trade as h };
