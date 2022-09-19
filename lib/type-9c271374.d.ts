import { Transaction, Signer, PublicKey } from '@solana/web3.js';
import BN__default from 'bn.js';
import { Structure, GetStructureFromLayoutSchema } from './marshmallow/index.js';
import { GetStructureSchema } from './marshmallow/buffer-layout.js';
import { i as BigNumberish, P as Percent, T as TokenAmount, w as Price } from './bignumber-2daa5944.js';
import { PublicKeyish } from './common/pubKey.js';
import { Token } from './module/token.js';
import { SplToken } from './raydium/token/type.js';
import { SplAccount } from './raydium/account/types.js';

interface RaydiumTokenInfo extends ApiTokenInfo {
    category: ApiTokenCategory;
}
declare type SignAllTransactions = ((transaction: Transaction[]) => Promise<Transaction[]>) | undefined;
interface MakeTransaction {
    signers: Signer[];
    transaction: Transaction;
    execute: () => Promise<string>;
    extInfo: Record<string, any>;
}
interface MakeMultiTransaction {
    signers: Signer[][];
    transactions: Transaction[];
    execute: () => Promise<string[]>;
    extInfo: Record<string, any>;
}
interface LoadParams {
    forceUpdate?: boolean;
}
declare type Primitive = boolean | number | string | null | undefined | PublicKey;
/**
 *
 * @example
 * ```typescript
 * interface A {
 *   keyA: string;
 *   keyB: string;
 *   map: {
 *     hello: string;
 *     i: number;
 *   };
 *   list: (string | number)[];
 *   keyC: number;
 * }
 *
 * type WrappedA = ReplaceType<A, string, boolean> // {
 *   keyA: boolean;
 *   keyB: boolean;
 *   map: {
 *     hello: boolean;
 *     i: number;
 *   };
 *   list: (number | boolean)[];
 *   keyC: number;
 * }
 * ```
 */
declare type ReplaceType<Old, From, To> = {
    [T in keyof Old]: Old[T] extends From ? Exclude<Old[T], From> | To : Old[T] extends Primitive ? From extends Old[T] ? Exclude<Old[T], From> | To : Old[T] : ReplaceType<Old[T], From, To>;
};
declare type MayArray<T> = T | Array<T>;
declare type MayDeepArray<T> = T | Array<MayDeepArray<T>>;
declare type MayFunction<T, PS extends any[] = []> = T | ((...Params: PS) => T);
declare type ArrayItem<T extends ReadonlyArray<any>> = T extends Array<infer P> ? P : never;
declare type ExactPartial<T, U> = {
    [P in Extract<keyof T, U>]?: T[P];
} & {
    [P in Exclude<keyof T, U>]: T[P];
};
declare type ExactRequired<T, U> = {
    [P in Extract<keyof T, U>]-?: T[P];
} & {
    [P in Exclude<keyof T, U>]: T[P];
};
/**
 * extract only string and number
 */
declare type SKeyof<O> = Extract<keyof O, string>;
declare type GetValue<T, K> = K extends keyof T ? T[K] : undefined;
/**
 * @example
 * type A = { a: number; b: string; c?: string }
 * type B = { a: string; c: string; d?: boolean }
 *
 * type D = SOR<A, B> // { a: number | string; b: string | undefined; c: string | undefined; d: boolean | undefined } // ! if use SOR, you lost union type guard feature, try NOT to use this trick
 */
declare type SOR<T, U> = {
    [K in keyof T | keyof U]: GetValue<T, K> | GetValue<U, K>;
};
declare type Fallback<T, FallbackT> = T extends undefined ? FallbackT : T;
/**
 * @example
 * type A = { a: number; b: string; c?: string }
 * type B = { a: string; c: string; d?: boolean }
 *
 * type D = Cover<A, B> // { a: string; b: string; c: string; d?: boolean}
 */
declare type Cover<O, T> = {
    [K in SKeyof<O> | SKeyof<T>]: Fallback<GetValue<T, K>, GetValue<O, K>>;
};
declare type UnionCover<O, T> = T extends T ? Cover<O, T> : never;
declare type MergeArr<Arr> = (Arr extends (infer T)[] ? T : never)[];
/**
 * typescript type helper function
 * @example
 * type A = { hello: string; version: 3 }[]
 * type B = { hello: string; version: 5 }[]
 * type OK = MergeArr<A | B> // ({ hello: string; version: 3 } | { hello: string; version: 5 })[]
 * type Wrong = A | B // { hello: string; version: 3 }[] | { hello: string; version: 5 }[] // <= this type can't have auto type intelligense of array.map
 */
declare const unionArr: <T>(arr: T) => MergeArr<T>;

declare const FARM_PROGRAM_ID_V3 = "EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q";
declare const FARM_PROGRAM_ID_V3_PUBKEY: PublicKey;
declare const FARM_PROGRAM_ID_V5 = "9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4z";
declare const FARM_PROGRAM_ID_V5_PUBKEY: PublicKey;
declare const FARM_PROGRAM_ID_V6 = "FarmqiPv5eAj3j1GMdMCMUGXqPUvmquZtMy86QH6rzhG";
declare const FARM_PROGRAM_ID_V6_PUBKEY: PublicKey;
declare type FarmVersion = 3 | 4 | 5 | 6;
declare const FARM_PROGRAMID_TO_VERSION: {
    [key: string]: FarmVersion;
};
declare const FARM_VERSION_TO_PROGRAMID: {
    [key in FarmVersion]?: PublicKey;
} & {
    [K: number]: PublicKey;
};
declare const FARM_LOCK_MINT: PublicKey;
declare const FARM_LOCK_VAULT: PublicKey;
declare const FARM_VERSION_TO_STATE_LAYOUT: {
    [version in FarmVersion]?: FarmStateLayout;
};
declare const FARM_VERSION_TO_LEDGER_LAYOUT: {
    [version in FarmVersion]?: FarmLedgerLayout;
};
declare const isValidFarmVersion: (version: number) => boolean;
declare const farmDespotVersionToInstruction: (version: number) => number;
declare const farmWithdrawVersionToInstruction: (version: number) => number;
declare const validateFarmRewards: (params: {
    version: number;
    rewardInfos: RewardInfoWithKey[];
    rewardTokenAccountsPublicKeys: PublicKey[];
}) => (() => string | undefined);
declare const poolTypeV6: {
    "Standard SPL": number;
    "Option tokens": number;
};

declare type RewardType = keyof typeof poolTypeV6;
interface APIRewardInfo {
    rewardMint: string;
    rewardVault: string;
    rewardOpenTime: number;
    rewardEndTime: number;
    rewardPerSecond: string | number;
    rewardSender?: string;
    rewardType: string;
}
interface RewardInfoWithKey {
    rewardMint: PublicKey;
    rewardVault: PublicKey;
    rewardOpenTime: number;
    rewardEndTime: number;
    rewardType: RewardType;
    rewardPerSecond: string | number;
    rewardSender?: PublicKey;
}
interface FarmPoolJsonInfo {
    id: string;
    lpMint: string;
    lpVault: string;
    baseMint: string;
    quoteMint: string;
    name: string;
    symbol: string;
    version: number;
    programId: string;
    authority: string;
    creator?: string;
    rewardInfos: APIRewardInfo[];
    upcoming: boolean;
    rewardPeriodMin?: number;
    rewardPeriodMax?: number;
    rewardPeriodExtend?: number;
    local: boolean;
    category: "stake" | "raydium" | "fusion" | "ecosystem";
}
interface FarmRewardInfo {
    rewardMint: PublicKey;
    rewardPerSecond: BigNumberish;
    rewardOpenTime: BigNumberish;
    rewardEndTime: BigNumberish;
    rewardType: RewardType;
}
interface FarmRewardInfoConfig {
    isSet: BN__default;
    rewardPerSecond: BN__default;
    rewardOpenTime: BN__default;
    rewardEndTime: BN__default;
    rewardType: BN__default;
}
interface RewardInfoKey {
    rewardMint: PublicKey;
    rewardVault: PublicKey;
    userRewardToken: PublicKey;
}
interface FarmPoolInfoV6 {
    version: number;
    programId: PublicKey;
    lpMint: PublicKey;
    rewardInfos: FarmRewardInfo[];
    lockInfo: {
        lockMint: PublicKey;
        lockVault: PublicKey;
    };
}
interface CreateFarm {
    poolId: PublicKeyish;
    rewardInfos: FarmRewardInfo[];
    payer?: PublicKey;
}
interface UpdateFarmReward {
    farmId: PublicKeyish;
    newRewardInfo: FarmRewardInfo;
    payer?: PublicKey;
}
interface FarmDWParam {
    farmId: PublicKey;
    amount: BigNumberish;
}
declare type FarmPoolKeys = {
    readonly id: PublicKey;
    readonly lpMint: PublicKey;
    readonly version: number;
    readonly programId: PublicKey;
    readonly authority: PublicKey;
    readonly lpVault: PublicKey;
    readonly upcoming: boolean;
    readonly rewardInfos: ({
        readonly rewardMint: PublicKey;
        readonly rewardVault: PublicKey;
    } | {
        readonly rewardMint: PublicKey;
        readonly rewardVault: PublicKey;
        readonly rewardOpenTime: number;
        readonly rewardEndTime: number;
        readonly rewardPerSecond: number;
        readonly rewardType: RewardType;
    })[];
};
declare type SdkParsedFarmInfoBase = {
    jsonInfo: FarmPoolJsonInfo;
    id: PublicKey;
    lpMint: PublicKey;
    programId: PublicKey;
    authority: PublicKey;
    lpVault: SplAccount;
    rewardInfos: RewardInfoWithKey[];
    /** only when user have deposited and connected wallet */
    ledger?: {
        id: PublicKey;
        owner: PublicKey;
        state: BN__default;
        deposited: BN__default;
        rewardDebts: BN__default[];
    };
    /** only when user have deposited and connected wallet */
    wrapped?: {
        pendingRewards: BN__default[];
    };
};
declare type SdkParsedFarmInfo = UnionCover<FarmPoolJsonInfo, SdkParsedFarmInfoBase & ({
    version: 6;
    state: FarmStateV6;
} | {
    version: 3;
    state: FarmStateV3;
} | {
    version: 5;
    state: FarmStateV5;
})>;
/** computed by other info  */
declare type HydratedRewardInfo = {
    userHavedReward: boolean;
    apr: Percent | undefined;
    token: SplToken | Token | undefined;
    /** only when user have deposited and connected wallet */
    userPendingReward: TokenAmount | undefined;
    version: 3 | 5 | 6;
    rewardVault: PublicKey;
    openTime?: Date;
    endTime?: Date;
    isOptionToken?: boolean;
    isRewarding?: boolean;
    isRewardBeforeStart?: boolean;
    isRewardEnded?: boolean;
    isRwardingBeforeEnd72h?: boolean;
    rewardPeriodMin?: number;
    rewardPeriodMax?: number;
    rewardPeriodExtend?: number;
    claimableRewards?: TokenAmount;
    owner?: string;
    perSecond?: string | number;
};
declare type HydratedFarmInfo = SdkParsedFarmInfo & {
    lp: SplToken | Token | /* staking pool */ undefined;
    lpPrice: Price | undefined;
    base: SplToken | Token | undefined;
    quote: SplToken | Token | undefined;
    name: string;
    ammId: string | undefined;
    /** only for v3/v5 */
    isDualFusionPool: boolean;
    isNormalFusionPool: boolean;
    isClosedPool: boolean;
    isStakePool: boolean;
    isUpcomingPool: boolean;
    isStablePool: boolean;
    /** new pool shoud sort in highest  */
    isNewPool: boolean;
    /** 7d */
    totalApr7d: Percent | undefined;
    /** 7d; undefined means couldn't find this token by known tokenList */
    raydiumFeeApr7d: Percent | undefined;
    totalApr30d: Percent | undefined;
    /** undefined means couldn't find this token by known tokenList */
    raydiumFeeApr30d: Percent | undefined;
    totalApr24h: Percent | undefined;
    /** undefined means couldn't find this token by known tokenList */
    raydiumFeeApr24h: Percent | undefined;
    tvl: TokenAmount | undefined;
    userHasStaked: boolean;
    rewards: HydratedRewardInfo[];
    userStakedLpAmount: TokenAmount | undefined;
    stakedLpAmount: TokenAmount | undefined;
};

declare const associatedLedgerAccountLayout: Structure<number, "", {
    instruction: number;
}>;
declare const withdrawRewardLayout: Structure<number, "", {
    instruction: number;
}>;
declare const realFarmStateV3Layout: Structure<PublicKey | BN__default, "", {
    nonce: BN__default;
    state: BN__default;
    lpVault: PublicKey;
    totalReward: BN__default;
    rewardVault: PublicKey;
    perShareReward: BN__default;
    lastSlot: BN__default;
    perSlotReward: BN__default;
}>;
declare const realFarmStateV5Layout: Structure<number | PublicKey | Buffer | BN__default, "", {
    nonce: BN__default;
    state: BN__default;
    lpVault: PublicKey;
    lastSlot: BN__default;
    rewardVaultA: PublicKey;
    totalRewardA: BN__default;
    perShareRewardA: BN__default;
    perSlotRewardA: BN__default;
    option: number;
    rewardVaultB: PublicKey;
    totalRewardB: BN__default;
    perShareRewardB: BN__default;
    perSlotRewardB: BN__default;
}>;
declare const realFarmV6Layout: Structure<PublicKey | BN__default | BN__default[] | {
    rewardState: BN__default;
    rewardOpenTime: BN__default;
    rewardEndTime: BN__default;
    rewardLastUpdateTime: BN__default;
    totalReward: BN__default;
    totalRewardEmissioned: BN__default;
    rewardClaimed: BN__default;
    rewardPerSecond: BN__default;
    accRewardPerShare: BN__default;
    rewardVault: PublicKey;
    rewardMint: PublicKey;
    rewardSender: PublicKey;
    rewardType: BN__default;
    padding: BN__default[];
}[], "", {
    nonce: BN__default;
    state: BN__default;
    validRewardTokenNum: BN__default;
    rewardMultiplier: BN__default;
    rewardPeriodMax: BN__default;
    rewardPeriodMin: BN__default;
    rewardPeriodExtend: BN__default;
    lpMint: PublicKey;
    lpVault: PublicKey;
    padding: BN__default[];
    rewardInfos: {
        rewardState: BN__default;
        rewardOpenTime: BN__default;
        rewardEndTime: BN__default;
        rewardLastUpdateTime: BN__default;
        totalReward: BN__default;
        totalRewardEmissioned: BN__default;
        rewardClaimed: BN__default;
        rewardPerSecond: BN__default;
        accRewardPerShare: BN__default;
        rewardVault: PublicKey;
        rewardMint: PublicKey;
        rewardSender: PublicKey;
        rewardType: BN__default;
        padding: BN__default[];
    }[];
    creator: PublicKey;
}>;
declare const farmStateV3Layout: GetStructureFromLayoutSchema<{
    version: 3;
    rewardInfos: {
        rewardVault: PublicKey;
        totalReward: BN__default;
        perSlotReward: BN__default;
        perShareReward: BN__default;
    }[];
} & {
    nonce: BN__default;
    state: BN__default;
    lpVault: PublicKey;
    totalReward: BN__default;
    rewardVault: PublicKey;
    perShareReward: BN__default;
    lastSlot: BN__default;
    perSlotReward: BN__default;
}>;
declare const farmStateV5Layout: GetStructureFromLayoutSchema<{
    version: 5;
    rewardInfos: {
        rewardVault: PublicKey;
        totalReward: BN__default;
        perSlotReward: BN__default;
        perShareReward: BN__default;
    }[];
} & {
    nonce: BN__default;
    state: BN__default;
    lpVault: PublicKey;
    lastSlot: BN__default;
    rewardVaultA: PublicKey;
    totalRewardA: BN__default;
    perShareRewardA: BN__default;
    perSlotRewardA: BN__default;
    option: number;
    rewardVaultB: PublicKey;
    totalRewardB: BN__default;
    perShareRewardB: BN__default;
    perSlotRewardB: BN__default;
}>;
declare const farmStateV6Layout: GetStructureFromLayoutSchema<{
    version: 6;
    rewardInfos: {
        rewardState: BN__default;
        rewardOpenTime: BN__default;
        rewardEndTime: BN__default;
        rewardLastUpdateTime: BN__default;
        totalReward: BN__default;
        totalRewardEmissioned: BN__default;
        rewardClaimed: BN__default;
        rewardPerSecond: BN__default;
        accRewardPerShare: BN__default;
        rewardVault: PublicKey;
        rewardMint: PublicKey;
        rewardSender: PublicKey;
        rewardType: RewardType;
    }[];
} & {
    nonce: BN__default;
    state: BN__default;
    validRewardTokenNum: BN__default;
    rewardMultiplier: BN__default;
    rewardPeriodMax: BN__default;
    rewardPeriodMin: BN__default;
    rewardPeriodExtend: BN__default;
    lpMint: PublicKey;
    lpVault: PublicKey;
    padding: BN__default[];
    rewardInfos: {
        rewardState: BN__default;
        rewardOpenTime: BN__default;
        rewardEndTime: BN__default;
        rewardLastUpdateTime: BN__default;
        totalReward: BN__default;
        totalRewardEmissioned: BN__default;
        rewardClaimed: BN__default;
        rewardPerSecond: BN__default;
        accRewardPerShare: BN__default;
        rewardVault: PublicKey;
        rewardMint: PublicKey;
        rewardSender: PublicKey;
        rewardType: BN__default;
        padding: BN__default[];
    }[];
    creator: PublicKey;
}>;
declare const farmRewardTimeInfoLayout: Structure<BN__default, "", {
    rewardOpenTime: BN__default;
    rewardEndTime: BN__default;
    rewardPerSecond: BN__default;
    rewardType: BN__default;
    isSet: BN__default;
}>;
declare const farmRewardLayout: Structure<number | BN__default | {
    rewardOpenTime: BN__default;
    rewardEndTime: BN__default;
    rewardPerSecond: BN__default;
    rewardType: BN__default;
    isSet: BN__default;
}[], "", {
    nonce: BN__default;
    instruction: number;
    rewardTimeInfo: {
        rewardOpenTime: BN__default;
        rewardEndTime: BN__default;
        rewardPerSecond: BN__default;
        rewardType: BN__default;
        isSet: BN__default;
    }[];
}>;
declare const farmRewardRestartLayout: Structure<number | BN__default, "", {
    rewardEndTime: BN__default;
    rewardPerSecond: BN__default;
    instruction: number;
    rewardReopenTime: BN__default;
}>;
declare const farmAddRewardLayout: Structure<number | BN__default, "", {
    rewardOpenTime: BN__default;
    rewardEndTime: BN__default;
    rewardPerSecond: BN__default;
    instruction: number;
    isSet: BN__default;
}>;
declare type FarmStateLayoutV3 = typeof farmStateV3Layout;
declare type FarmStateLayoutV5 = typeof farmStateV5Layout;
declare type FarmStateLayoutV6 = typeof farmStateV6Layout;
declare type FarmStateV3 = GetStructureSchema<FarmStateLayoutV3>;
declare type FarmStateV5 = GetStructureSchema<FarmStateLayoutV5>;
declare type FarmStateV6 = GetStructureSchema<FarmStateLayoutV6>;
declare type FarmState = FarmStateV3 | FarmStateV5 | FarmStateV6;
declare type FarmStateLayout = FarmStateLayoutV3 | FarmStateLayoutV5 | FarmStateLayoutV6;
declare const farmLedgerLayoutV3_1: Structure<PublicKey | BN__default | BN__default[], "", {
    id: PublicKey;
    owner: PublicKey;
    state: BN__default;
    deposited: BN__default;
    rewardDebts: BN__default[];
}>;
declare const farmLedgerLayoutV3_2: Structure<PublicKey | BN__default | BN__default[], "", {
    id: PublicKey;
    owner: PublicKey;
    state: BN__default;
    deposited: BN__default;
    rewardDebts: BN__default[];
}>;
declare const farmLedgerLayoutV5_1: Structure<PublicKey | BN__default | BN__default[], "", {
    id: PublicKey;
    owner: PublicKey;
    state: BN__default;
    deposited: BN__default;
    rewardDebts: BN__default[];
}>;
declare const farmLedgerLayoutV5_2: Structure<PublicKey | BN__default | BN__default[], "", {
    id: PublicKey;
    owner: PublicKey;
    state: BN__default;
    deposited: BN__default;
    rewardDebts: BN__default[];
}>;
declare const farmLedgerLayoutV6_1: Structure<PublicKey | BN__default | BN__default[], "", {
    id: PublicKey;
    owner: PublicKey;
    state: BN__default;
    deposited: BN__default;
    rewardDebts: BN__default[];
}>;
declare type FarmLedgerLayoutV3_1 = typeof farmLedgerLayoutV3_1;
declare type FarmLedgerLayoutV3_2 = typeof farmLedgerLayoutV3_2;
declare type FarmLedgerLayoutV5_1 = typeof farmLedgerLayoutV5_1;
declare type FarmLedgerLayoutV5_2 = typeof farmLedgerLayoutV5_2;
declare type FarmLedgerLayoutV6_1 = typeof farmLedgerLayoutV6_1;
declare type FarmLedgerLayout = FarmLedgerLayoutV3_1 | FarmLedgerLayoutV3_2 | FarmLedgerLayoutV5_1 | FarmLedgerLayoutV5_2 | FarmLedgerLayoutV6_1;
declare type FarmLedgerV3_1 = GetStructureSchema<FarmLedgerLayoutV3_1>;
declare type FarmLedgerV3_2 = GetStructureSchema<FarmLedgerLayoutV3_2>;
declare type FarmLedgerV5_1 = GetStructureSchema<FarmLedgerLayoutV5_1>;
declare type FarmLedgerV5_2 = GetStructureSchema<FarmLedgerLayoutV5_2>;
declare type FarmLedgerV6_1 = GetStructureSchema<FarmLedgerLayoutV6_1>;
declare type FarmLedger = FarmLedgerV3_1 | FarmLedgerV3_2 | FarmLedgerV5_1 | FarmLedgerV5_2 | FarmLedgerV6_1;
declare const dwLayout: Structure<number | BN__default, "", {
    amount: BN__default;
    instruction: number;
}>;

interface ApiTokenInfo {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    icon: string;
    extensions: {
        [key in "coingeckoId" | "website" | "whitepaper"]?: string;
    };
}
declare type ApiTokenCategory = "official" | "unOfficial" | "unNamed" | "blacklist";
declare type ApiTokens = {
    official: ApiTokenInfo[];
    unOfficial: ApiTokenInfo[];
    unNamed: string[];
    blacklist: string[];
};
declare type LiquidityVersion = 4 | 5;
declare type SerumVersion = 1 | 2 | 3;
interface ApiLiquidityPoolInfo {
    id: string;
    baseMint: string;
    quoteMint: string;
    lpMint: string;
    baseDecimals: number;
    quoteDecimals: number;
    lpDecimals: number;
    version: LiquidityVersion;
    programId: string;
    authority: string;
    openOrders: string;
    targetOrders: string;
    baseVault: string;
    quoteVault: string;
    withdrawQueue: string;
    lpVault: string;
    marketVersion: SerumVersion;
    marketProgramId: string;
    marketId: string;
    marketAuthority: string;
    marketBaseVault: string;
    marketQuoteVault: string;
    marketBids: string;
    marketAsks: string;
    marketEventQueue: string;
}
declare type ApiLiquidityPools = {
    [key in "official" | "unOfficial"]: ApiLiquidityPoolInfo[];
};
interface ApiJsonPairInfo {
    ammId: string;
    apr24h: number;
    apr7d: number;
    apr30d: number;
    fee7d: number;
    fee7dQuote: number;
    fee24h: number;
    fee24hQuote: number;
    fee30d: number;
    fee30dQuote: number;
    liquidity: number;
    lpMint: string;
    lpPrice: number | null;
    market: string;
    name: string;
    official: boolean;
    price: number;
    tokenAmountCoin: number;
    tokenAmountLp: number;
    tokenAmountPc: number;
    volume7d: number;
    volume7dQuote: number;
    volume24h: number;
    volume24hQuote: number;
    volume30d: number;
    volume30dQuote: number;
}
interface FarmRewardInfoV6 {
    rewardMint: string;
    rewardVault: string;
    rewardOpenTime: number;
    rewardEndTime: number;
    rewardPerSecond: number;
    rewardSender: string;
}
interface ApiStakePoolInfo {
    id: string;
    symbol: string;
    lpMint: string;
    version: FarmVersion;
    programId: string;
    authority: string;
    lpVault: string;
    rewardInfos: FarmRewardInfo[] | FarmRewardInfoV6[];
    upcoming: boolean;
}
interface ApiFarmPoolInfo extends ApiStakePoolInfo {
    baseMint: string;
    quoteMint: string;
}
interface ApiFarmPools {
    stake: ApiStakePoolInfo[];
    raydium: ApiFarmPoolInfo[];
    fusion: ApiFarmPoolInfo[];
    ecosystem: ApiFarmPoolInfo[];
}

export { FarmPoolJsonInfo as $, ApiTokenInfo as A, FarmState as B, FarmStateLayout as C, farmLedgerLayoutV3_1 as D, farmLedgerLayoutV3_2 as E, FarmRewardInfoV6 as F, farmLedgerLayoutV5_1 as G, farmLedgerLayoutV5_2 as H, farmLedgerLayoutV6_1 as I, FarmLedgerLayoutV3_1 as J, FarmLedgerLayoutV3_2 as K, LiquidityVersion as L, FarmLedgerLayoutV5_1 as M, FarmLedgerLayoutV5_2 as N, FarmLedgerLayoutV6_1 as O, FarmLedgerLayout as P, FarmLedgerV3_1 as Q, FarmLedgerV3_2 as R, SerumVersion as S, FarmLedgerV5_1 as T, FarmLedgerV5_2 as U, FarmLedgerV6_1 as V, FarmLedger as W, dwLayout as X, RewardType as Y, APIRewardInfo as Z, RewardInfoWithKey as _, ApiTokenCategory as a, FarmRewardInfo as a0, FarmRewardInfoConfig as a1, RewardInfoKey as a2, FarmPoolInfoV6 as a3, CreateFarm as a4, UpdateFarmReward as a5, FarmDWParam as a6, FarmPoolKeys as a7, SdkParsedFarmInfo as a8, HydratedRewardInfo as a9, MayDeepArray as aA, MayFunction as aB, ArrayItem as aC, ExactPartial as aD, ExactRequired as aE, SKeyof as aF, GetValue as aG, SOR as aH, Fallback as aI, Cover as aJ, UnionCover as aK, unionArr as aL, HydratedFarmInfo as aa, FARM_PROGRAM_ID_V3 as ab, FARM_PROGRAM_ID_V3_PUBKEY as ac, FARM_PROGRAM_ID_V5 as ad, FARM_PROGRAM_ID_V5_PUBKEY as ae, FARM_PROGRAM_ID_V6 as af, FARM_PROGRAM_ID_V6_PUBKEY as ag, FarmVersion as ah, FARM_PROGRAMID_TO_VERSION as ai, FARM_VERSION_TO_PROGRAMID as aj, FARM_LOCK_MINT as ak, FARM_LOCK_VAULT as al, FARM_VERSION_TO_STATE_LAYOUT as am, FARM_VERSION_TO_LEDGER_LAYOUT as an, isValidFarmVersion as ao, farmDespotVersionToInstruction as ap, farmWithdrawVersionToInstruction as aq, validateFarmRewards as ar, poolTypeV6 as as, RaydiumTokenInfo as at, SignAllTransactions as au, MakeTransaction as av, MakeMultiTransaction as aw, LoadParams as ax, ReplaceType as ay, MayArray as az, ApiTokens as b, ApiLiquidityPoolInfo as c, ApiLiquidityPools as d, ApiJsonPairInfo as e, ApiStakePoolInfo as f, ApiFarmPoolInfo as g, ApiFarmPools as h, associatedLedgerAccountLayout as i, realFarmStateV5Layout as j, realFarmV6Layout as k, farmStateV3Layout as l, farmStateV5Layout as m, farmStateV6Layout as n, farmRewardTimeInfoLayout as o, farmRewardLayout as p, farmRewardRestartLayout as q, realFarmStateV3Layout as r, farmAddRewardLayout as s, FarmStateLayoutV3 as t, FarmStateLayoutV5 as u, FarmStateLayoutV6 as v, withdrawRewardLayout as w, FarmStateV3 as x, FarmStateV5 as y, FarmStateV6 as z };
