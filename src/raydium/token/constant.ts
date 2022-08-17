import { PublicKey } from "@solana/web3.js";

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

export const quantumSOLHydratedTokenJsonInfo = {
  isQuantumSOL: true,
  isLp: false,
  official: true,
  mint: new PublicKey(TOKEN_WSOL.mint),
  decimals: 9,
  symbol: "SOL",
  id: "sol",
  name: "solana",
  icon: `https://img.raydium.io/icon/So11111111111111111111111111111111111111112.png`,
  extensions: {
    coingeckoId: "solana",
  },
};
