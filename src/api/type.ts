/* ================= token ================= */
export type TokenExtensionKey = "coingeckoId" | "website" | "whitepaper";

export type TokenExtensions = { [key in TokenExtensionKey]?: string };

export interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  icon: string;
  extensions: TokenExtensions;
}

export interface Tokens {
  official: TokenInfo[];
  unOfficial: TokenInfo[];
  unNamed: TokenInfo[];
  blacklist: TokenInfo[];
}

/* ================= liquidity ================= */
export type LiquidityVersion = 2 | 3 | 4;

export type SerumVersion = 1 | 2 | 3;

export interface LiquidityPoolInfo {
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

export interface LiquidityPools {
  official: LiquidityPoolInfo[];
  unOfficial: LiquidityPoolInfo[];
}

/* ================= farm ================= */
export type FarmVersion = 3 | 4 | 5 | 6;

export interface FarmRewardInfo {
  rewardMint: string;
  rewardVault: string;
}

export interface FarmRewardInfoV6 {
  rewardMint: string;
  rewardVault: string;
  rewardOpenTime: number;
  rewardEndTime: number;
  rewardPerSecond: number;
  rewardSender: string;
}

export interface StakePoolInfo {
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

export interface FarmPoolInfo extends StakePoolInfo {
  baseMint: string;
  quoteMint: string;
}

export interface FarmPools {
  stake: StakePoolInfo[];
  raydium: FarmPoolInfo[];
  fusion: FarmPoolInfo[];
  ecosystem: FarmPoolInfo[];
}
