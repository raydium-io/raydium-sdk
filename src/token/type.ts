import { LiquidityVersion } from "../liquidity";
import { JsonFileMetaData } from "../types/json-file";

// Native SOL
export interface NativeTokenInfo {
  readonly symbol: string;
  readonly name: string;

  readonly decimals: number;
}

export type ExtensionKey = "coingeckoId" | "website" | "whitepaper";

export type Extensions = { [key in ExtensionKey]?: string };

// SPL token
export interface SplTokenInfo extends NativeTokenInfo {
  // readonly chainId: ENV;
  readonly mint: string;

  readonly extensions: Extensions;
}

// SPL tokens
export type SplTokens = {
  [Symbol.iterator](): IterableIterator<SplTokenInfo>;
} & {
  [T in string]: SplTokenInfo;
};

// LP token
export interface LpTokenInfo extends NativeTokenInfo {
  readonly mint: string;

  readonly base: SplTokenInfo;
  readonly quote: SplTokenInfo;

  readonly version: LiquidityVersion;
}

// LP tokens
export type LpTokens = {
  [Symbol.iterator](): IterableIterator<LpTokenInfo>;
} & {
  [T in string]: LpTokenInfo;
};

/* ================= json file ================= */
export interface SplTokenJsonInfo {
  readonly symbol: string;
  readonly name: string;
  readonly mint: string;
  readonly decimals: number;
  readonly extensions: Extensions;
}

export interface LpTokenJsonInfo {
  readonly symbol: string;
  readonly name: string;
  readonly mint: string;
  readonly base: string;
  readonly quote: string;
  readonly decimals: number;
  readonly version: LiquidityVersion;
}

export type SplTokensJsonInfo = {
  [Symbol.iterator](): IterableIterator<SplTokenJsonInfo>;
} & {
  [T in string]: SplTokenJsonInfo;
};

export type LpTokensJsonInfo = {
  [Symbol.iterator](): IterableIterator<LpTokenJsonInfo>;
} & {
  [T in string]: LpTokenJsonInfo;
};

export interface TokensJsonFile extends JsonFileMetaData {
  readonly spl: SplTokensJsonInfo;
  readonly lp: LpTokensJsonInfo;
}
