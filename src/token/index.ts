import { NativeTokenInfo, SplTokenInfo } from "./type";

export const TOKEN_SOL: NativeTokenInfo = {
  symbol: "SOL",
  name: "Solana",
  decimals: 9,
};

export const TOKEN_WSOL: SplTokenInfo = {
  symbol: "WSOL",
  name: "Wrapped SOL",
  mint: "So11111111111111111111111111111111111111112",
  decimals: 9,
  extensions: {
    coingeckoId: "solana",
  },
};
