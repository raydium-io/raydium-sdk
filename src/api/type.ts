import { FarmRewardInfo, FarmVersion } from "../raydium/farm";

/* ================= token ================= */
export interface ApiTokenInfo {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  icon: string;
  extensions: { [key in "coingeckoId" | "website" | "whitepaper"]?: string };
}

export type ApiTokenCategory = "official" | "unOfficial" | "unNamed" | "blacklist";

export type ApiTokens = {
  official: ApiTokenInfo[];
  unOfficial: ApiTokenInfo[];
  unNamed: string[];
  blacklist: string[];
};

/* ================= liquidity ================= */
export type LiquidityVersion = 4 | 5;

export type SerumVersion = 1 | 2 | 3;

export interface ApiLiquidityPoolInfo {
  // base
  id: string;
  baseMint: string;
  quoteMint: string;
  lpMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  lpDecimals: number;
  // version
  version: LiquidityVersion;
  programId: string;
  // keys
  authority: string;
  openOrders: string;
  targetOrders: string;
  baseVault: string;
  quoteVault: string;
  withdrawQueue: string;
  lpVault: string;
  // market version
  marketVersion: SerumVersion;
  marketProgramId: string;
  // market keys
  marketId: string;
  marketAuthority: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
}

export type ApiLiquidityPools = { [key in "official" | "unOfficial"]: ApiLiquidityPoolInfo[] };

/* ================= farm ================= */
export interface FarmRewardInfoV6 {
  rewardMint: string;
  rewardVault: string;
  rewardOpenTime: number;
  rewardEndTime: number;
  rewardPerSecond: number;
  rewardSender: string;
}

export interface ApiStakePoolInfo {
  // base
  id: string;
  symbol: string;
  lpMint: string;
  // version
  version: FarmVersion;
  programId: string;
  // keys
  authority: string;
  lpVault: string;
  rewardInfos: FarmRewardInfo[] | FarmRewardInfoV6[];
  // status
  upcoming: boolean;
}

export interface ApiFarmPoolInfo extends ApiStakePoolInfo {
  baseMint: string;
  quoteMint: string;
}

export interface ApiFarmPools {
  stake: ApiStakePoolInfo[];
  raydium: ApiFarmPoolInfo[];
  fusion: ApiFarmPoolInfo[];
  ecosystem: ApiFarmPoolInfo[];
}
