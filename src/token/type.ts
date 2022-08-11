export type ExtensionKey = "coingeckoId" | "website" | "whitepaper";
export type Extensions = { [key in ExtensionKey]?: string };

// Native SOL
export interface NativeTokenInfo {
  readonly symbol: string;
  readonly name: string;

  readonly decimals: number;
}

// SPL token
export interface SplTokenInfo extends NativeTokenInfo {
  // readonly chainId: ENV;
  readonly mint: string;

  readonly extensions: Extensions;
}
