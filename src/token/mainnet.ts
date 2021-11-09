import { WSOL } from "./sol";
import { LpTokens, SplTokens } from "./type";

export const MAINNET_SPL_TOKENS: SplTokens = {
  *[Symbol.iterator]() {
    yield* Object.values(this);
  },
  WSOL: {
    ...WSOL,
  },
  BTC: {
    symbol: "BTC",
    name: "Wrapped Bitcoin",
    mint: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
    decimals: 6,
    extensions: {
      coingeckoId: "bitcoin",
    },
  },
  ETH: {
    symbol: "ETH",
    name: "Wrapped Ethereum",
    mint: "2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk",
    decimals: 6,
    extensions: {
      coingeckoId: "ethereum",
    },
  },
  USDT: {
    symbol: "USDT",
    name: "USDT",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    extensions: {
      coingeckoId: "tether",
    },
  },
  WUSDT: {
    symbol: "WUSDT",
    name: "Wrapped USDT",
    mint: "BQcdHdAQW1hczDbBi9hiegXAR7A98Q9jx3X3iBBBDiq4",
    decimals: 6,
    extensions: {
      coingeckoId: "tether",
    },
  },
  USDC: {
    symbol: "USDC",
    name: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    extensions: {
      coingeckoId: "usd-coin",
    },
  },
  WUSDC: {
    symbol: "WUSDC",
    name: "Wrapped USDC",
    mint: "BXXkv6z8ykpG1yuvUDPgh732wzVHB69RnB9YgSYh3itW",
    decimals: 6,
    extensions: {
      coingeckoId: "usd-coin",
    },
  },
  YFI: {
    symbol: "YFI",
    name: "Wrapped YFI",
    mint: "3JSf5tPeuscJGtaCp5giEiDhv51gQ4v3zWg8DGgyLfAB",
    decimals: 6,
    extensions: {
      coingeckoId: "yearn-finance",
    },
  },
  LINK: {
    symbol: "LINK",
    name: "Wrapped Chainlink",
    mint: "CWE8jPTUYhdCTZYWPTe1o5DFqfdjzWKc9WKz6rSjQUdG",
    decimals: 6,
    extensions: {
      coingeckoId: "chainlink",
    },
  },
  XRP: {
    symbol: "XRP",
    name: "Wrapped XRP",
    mint: "Ga2AXHpfAF6mv2ekZwcsJFqu7wB4NV331qNH7fW9Nst8",
    decimals: 6,
    extensions: {
      coingeckoId: "ripple",
    },
  },
  SUSHI: {
    symbol: "SUSHI",
    name: "Wrapped SUSHI",
    mint: "AR1Mtgh7zAtxuxGd2XPovXPVjcSdY3i4rQYisNadjfKy",
    decimals: 6,
    extensions: {
      coingeckoId: "sushi",
    },
  },
  ALEPH: {
    symbol: "ALEPH",
    name: "Wrapped ALEPH",
    mint: "CsZ5LZkDS7h9TDKjrbL7VAwQZ9nsRu8vJLhRYfmGaN8K",
    decimals: 6,
    extensions: {
      coingeckoId: "aleph",
    },
  },
  SXP: {
    symbol: "SXP",
    name: "Wrapped SXP",
    mint: "SF3oTvfWzEP3DTwGSvUXRrGTvr75pdZNnBLAH9bzMuX",
    decimals: 6,
    extensions: {
      coingeckoId: "swipe",
    },
  },
  HGET: {
    symbol: "HGET",
    name: "Wrapped HGET",
    mint: "BtZQfWqDGbk9Wf2rXEiWyQBdBY1etnUUn6zEphvVS7yN",
    decimals: 6,
    extensions: {
      coingeckoId: "hedget",
    },
  },
  CREAM: {
    symbol: "CREAM",
    name: "Wrapped CREAM",
    mint: "5Fu5UUgbjpUvdBveb3a1JTNirL8rXtiYeSMWvKjtUNQv",
    decimals: 6,
    extensions: {
      coingeckoId: "cream-2",
    },
  },
  UBXT: {
    symbol: "UBXT",
    name: "Wrapped UBXT",
    mint: "873KLxCbz7s9Kc4ZzgYRtNmhfkQrhfyWGZJBmyCbC3ei",
    decimals: 6,
    extensions: {
      coingeckoId: "upbots",
    },
  },
  HNT: {
    symbol: "HNT",
    name: "Wrapped HNT",
    mint: "HqB7uswoVg4suaQiDP3wjxob1G5WdZ144zhdStwMCq7e",
    decimals: 6,
    extensions: {
      coingeckoId: "helium",
    },
  },
  FRONT: {
    symbol: "FRONT",
    name: "Wrapped FRONT",
    mint: "9S4t2NEAiJVMvPdRYKVrfJpBafPBLtvbvyS3DecojQHw",
    decimals: 6,
    extensions: {
      coingeckoId: "frontier-token",
    },
  },
  AKRO: {
    symbol: "AKRO",
    name: "Wrapped AKRO",
    mint: "6WNVCuxCGJzNjmMZoKyhZJwvJ5tYpsLyAtagzYASqBoF",
    decimals: 6,
    extensions: {
      coingeckoId: "akropolis",
    },
  },
  HXRO: {
    symbol: "HXRO",
    name: "Wrapped HXRO",
    mint: "DJafV9qemGp7mLMEn5wrfqaFwxsbLgUsGVS16zKRk9kc",
    decimals: 6,
    extensions: {
      coingeckoId: "hxro",
    },
  },
  UNI: {
    symbol: "UNI",
    name: "Wrapped UNI",
    mint: "DEhAasscXF4kEGxFgJ3bq4PpVGp5wyUxMRvn6TzGVHaw",
    decimals: 6,
    extensions: {
      coingeckoId: "uniswap",
    },
  },
  SRM: {
    symbol: "SRM",
    name: "Serum",
    mint: "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt",
    decimals: 6,
    extensions: {
      coingeckoId: "serum",
    },
  },
  FTT: {
    symbol: "FTT",
    name: "Wrapped FTT",
    mint: "AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3",
    decimals: 6,
    extensions: {
      coingeckoId: "ftx-token",
    },
  },
  MSRM: {
    symbol: "MSRM",
    name: "MegaSerum",
    mint: "MSRMcoVyrFxnSgo5uXwone5SKcGhT1KEJMFEkMEWf9L",
    decimals: 0,
    extensions: {
      coingeckoId: "megaserum",
    },
  },
  TOMO: {
    symbol: "TOMO",
    name: "Wrapped TOMO",
    mint: "GXMvfY2jpQctDqZ9RoU3oWPhufKiCcFEfchvYumtX7jd",
    decimals: 6,
    extensions: {
      coingeckoId: "tomochain",
    },
  },
  KARMA: {
    symbol: "KARMA",
    name: "Wrapped KARMA",
    mint: "EcqExpGNFBve2i1cMJUTR4bPXj4ZoqmDD2rTkeCcaTFX",
    decimals: 4,
    extensions: {
      coingeckoId: "karma-dao",
    },
  },
  LUA: {
    symbol: "LUA",
    name: "Wrapped LUA",
    mint: "EqWCKXfs3x47uVosDpTRgFniThL9Y8iCztJaapxbEaVX",
    decimals: 6,
    extensions: {
      coingeckoId: "lua-token",
    },
  },
  MATH: {
    symbol: "MATH",
    name: "Wrapped MATH",
    mint: "GeDS162t9yGJuLEHPWXXGrb1zwkzinCgRwnT8vHYjKza",
    decimals: 6,
    extensions: {
      coingeckoId: "math",
    },
  },
  KEEP: {
    symbol: "KEEP",
    name: "Wrapped KEEP",
    mint: "GUohe4DJUA5FKPWo3joiPgsB7yzer7LpDmt1Vhzy3Zht",
    decimals: 6,
    extensions: {
      coingeckoId: "keep-network",
    },
  },
  SWAG: {
    symbol: "SWAG",
    name: "Wrapped SWAG",
    mint: "9F9fNTT6qwjsu4X4yWYKZpsbw5qT7o6yR2i57JF2jagy",
    decimals: 6,
    extensions: {
      coingeckoId: "swag-finance",
    },
  },
  FIDA: {
    symbol: "FIDA",
    name: "Bonfida",
    mint: "EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp",
    decimals: 6,
    extensions: {
      coingeckoId: "bonfida",
    },
  },
  KIN: {
    symbol: "KIN",
    name: "KIN",
    mint: "kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6",
    decimals: 5,
    extensions: {
      coingeckoId: "kin",
    },
  },
  MAPS: {
    symbol: "MAPS",
    name: "MAPS",
    mint: "MAPS41MDahZ9QdKXhVa4dWB9RuyfV4XqhyAZ8XcYepb",
    decimals: 6,
    extensions: {
      coingeckoId: "maps",
    },
  },
  OXY: {
    symbol: "OXY",
    name: "OXY",
    mint: "z3dn17yLaGMKffVogeFHQ9zWVcXgqgf3PQnDsNs2g6M",
    decimals: 6,
    extensions: {
      coingeckoId: "oxygen",
    },
  },
  RAY: {
    symbol: "RAY",
    name: "Raydium",
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    decimals: 6,
    extensions: {
      coingeckoId: "raydium",
    },
  },
  xCOPE: {
    symbol: "xCOPE",
    name: "xCOPE",
    mint: "3K6rftdAaQYMPunrtNRHgnK2UAtjm2JwyT2oCiTDouYE",
    decimals: 0,
    extensions: {
      coingeckoId: "cope",
    },
  },
  COPE: {
    symbol: "COPE",
    name: "COPE",
    mint: "8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh",
    decimals: 6,
    extensions: {
      coingeckoId: "cope",
    },
  },
  STEP: {
    symbol: "STEP",
    name: "STEP",
    mint: "StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT",
    decimals: 9,
    extensions: {
      coingeckoId: "step-finance",
    },
  },
  MEDIA: {
    symbol: "MEDIA",
    name: "MEDIA",
    mint: "ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs",
    decimals: 6,
    extensions: {
      coingeckoId: "media-network",
    },
  },
  ROPE: {
    symbol: "ROPE",
    name: "ROPE",
    mint: "8PMHT4swUMtBzgHnh5U564N5sjPSiUz2cjEQzFnnP1Fo",
    decimals: 9,
    extensions: {
      coingeckoId: "rope-token",
    },
  },
  MER: {
    symbol: "MER",
    name: "Mercurial",
    mint: "MERt85fc5boKw3BW1eYdxonEuJNvXbiMbs6hvheau5K",
    decimals: 6,
    extensions: {
      coingeckoId: "mercurial",
    },
  },
  TULIP: {
    symbol: "TULIP",
    name: "TULIP",
    mint: "TuLipcqtGVXP9XR62wM8WWCm6a9vhLs7T1uoWBk6FDs",
    decimals: 6,
    extensions: {
      coingeckoId: "solfarm",
    },
  },
  SNY: {
    symbol: "SNY",
    name: "SNY",
    mint: "4dmKkXNHdgYsXqBHCuMikNQWwVomZURhYvkkX5c4pQ7y",
    decimals: 6,
    extensions: {
      coingeckoId: "synthetify-token",
    },
  },
  SLRS: {
    symbol: "SLRS",
    name: "SLRS",
    mint: "SLRSSpSLUTP7okbCUBYStWCo1vUgyt775faPqz8HUMr",
    decimals: 6,
    extensions: {
      coingeckoId: "solrise-finance",
    },
  },
  WOO: {
    symbol: "WOO",
    name: "Wootrade Network",
    mint: "E5rk3nmgLUuKUiS94gg4bpWwWwyjCMtddsAXkTFLtHEy",
    decimals: 6,
    extensions: {
      coingeckoId: "woo-network",
    },
  },
  BOP: {
    symbol: "BOP",
    name: "Boring Protocol",
    mint: "BLwTnYKqf7u4qjgZrrsKeNs2EzWkMLqVCu6j8iHyrNA3",
    decimals: 8,
    extensions: {
      coingeckoId: "boring-protocol",
    },
  },
  SAMO: {
    symbol: "SAMO",
    name: "Samoyed Coin",
    mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    decimals: 9,
    extensions: {
      coingeckoId: "samoyedcoin",
    },
  },
  renBTC: {
    symbol: "renBTC",
    name: "renBTC",
    mint: "CDJWUqTcYTVAKXAVXoQZFes5JUFc7owSeq7eMQcDSbo5",
    decimals: 8,
    extensions: {
      coingeckoId: "renbtc",
    },
  },
  renDOGE: {
    symbol: "renDOGE",
    name: "renDOGE",
    mint: "ArUkYE2XDKzqy77PRRGjo4wREWwqk6RXTfM9NeqzPvjU",
    decimals: 8,
    extensions: {
      coingeckoId: "rendoge",
    },
  },
  LIKE: {
    symbol: "LIKE",
    name: "LIKE",
    mint: "3bRTivrVsitbmCTGtqwp7hxXPsybkjn4XLNtPsHqa3zR",
    decimals: 9,
    extensions: {
      coingeckoId: "only1",
    },
  },
  DXL: {
    symbol: "DXL",
    name: "DXL",
    mint: "GsNzxJfFn6zQdJGeYsupJWzUAm57Ba7335mfhWvFiE9Z",
    decimals: 6,
    extensions: {
      coingeckoId: "dexlab",
    },
  },
  mSOL: {
    symbol: "mSOL",
    name: "Marinade staked SOL",
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    decimals: 9,
    extensions: {
      coingeckoId: "msol",
    },
  },
  PAI: {
    symbol: "PAI",
    name: "Parrot",
    mint: "Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS",
    decimals: 6,
    extensions: {
      coingeckoId: "parrot-usd",
    },
  },
  PORT: {
    symbol: "PORT",
    name: "PORT",
    mint: "PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y",
    decimals: 6,
    extensions: {
      coingeckoId: "port-finance",
    },
  },
  MNGO: {
    symbol: "MNGO",
    name: "Mango",
    mint: "MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac",
    decimals: 6,
    extensions: {
      coingeckoId: "mango-markets",
    },
  },
  CRP: {
    symbol: "CRP",
    name: "CRP",
    mint: "DubwWZNWiNGMMeeQHPnMATNj77YZPZSAz2WVR5WjLJqz",
    decimals: 9,
    extensions: {
      coingeckoId: "cropperfinance",
    },
  },
  ATLAS: {
    symbol: "ATLAS",
    name: "ATLAS",
    mint: "ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx",
    decimals: 8,
    extensions: {
      coingeckoId: "star-atlas",
    },
  },
  POLIS: {
    symbol: "POLIS",
    name: "POLIS",
    mint: "poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk",
    decimals: 8,
    extensions: {
      coingeckoId: "star-atlas-dao",
    },
  },
};

export const MAINNET_LP_TOKENS: LpTokens = {
  *[Symbol.iterator]() {
    yield* Object.values(this);
  },
  RAY_WUSDT_V2: {
    symbol: "RAY-WUSDT",
    name: "RAY-WUSDT V2 LP",
    mint: "CzPDyvotTcxNqtPne32yUiEVQ6jk42HZi1Y3hUu7qf7f",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.WUSDT,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 2,
  },
  RAY_SOL_V2: {
    symbol: "RAY-SOL",
    name: "RAY-SOL V2 LP",
    mint: "134Cct3CSdRCbYgq5SkwmHgfwjJ7EM5cG9PzqffWqECx",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.WSOL,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 2,
  },
  LINK_WUSDT_V2: {
    symbol: "LINK-WUSDT",
    name: "LINK-WUSDT V2 LP",
    mint: "EVDmwajM5U73PD34bYPugwiA4Eqqbrej4mLXXv15Z5qR",

    base: MAINNET_SPL_TOKENS.LINK,
    quote: MAINNET_SPL_TOKENS.WUSDT,
    decimals: MAINNET_SPL_TOKENS.LINK.decimals,

    version: 2,
  },
  ETH_WUSDT_V2: {
    symbol: "ETH-WUSDT",
    name: "ETH-WUSDT V2 LP",
    mint: "KY4XvwHy7JPzbWYAbk23jQvEb4qWJ8aCqYWREmk1Q7K",

    base: MAINNET_SPL_TOKENS.ETH,
    quote: MAINNET_SPL_TOKENS.WUSDT,
    decimals: MAINNET_SPL_TOKENS.ETH.decimals,

    version: 2,
  },
  RAY_USDC_V2: {
    symbol: "RAY-USDC",
    name: "RAY-USDC V2 LP",
    mint: "FgmBnsF5Qrnv8X9bomQfEtQTQjNNiBCWRKGpzPnE5BDg",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 2,
  },
  RAY_SRM_V2: {
    symbol: "RAY-SRM",
    name: "RAY-SRM V2 LP",
    mint: "5QXBMXuCL7zfAk39jEVVEvcrz1AvBGgT9wAhLLHLyyUJ",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.SRM,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 2,
  },
  RAY_WUSDT_V3: {
    symbol: "RAY-WUSDT",
    name: "RAY-WUSDT V3 LP",
    mint: "FdhKXYjCou2jQfgKWcNY7jb8F2DPLU1teTTTRfLBD2v1",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.WUSDT,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 3,
  },
  RAY_USDC_V3: {
    symbol: "RAY-USDC",
    name: "RAY-USDC V3 LP",
    mint: "BZFGfXMrjG2sS7QT2eiCDEevPFnkYYF7kzJpWfYxPbcx",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 3,
  },
  RAY_SRM_V3: {
    symbol: "RAY-SRM",
    name: "RAY-SRM V3 LP",
    mint: "DSX5E21RE9FB9hM8Nh8xcXQfPK6SzRaJiywemHBSsfup",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.SRM,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 3,
  },
  RAY_SOL_V3: {
    symbol: "RAY-SOL",
    name: "RAY-SOL V3 LP",
    mint: "F5PPQHGcznZ2FxD9JaxJMXaf7XkaFFJ6zzTBcW8osQjw",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.WSOL,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 3,
  },
  RAY_ETH_V3: {
    symbol: "RAY-ETH",
    name: "RAY-ETH V3 LP",
    mint: "8Q6MKy5Yxb9vG1mWzppMtMb2nrhNuCRNUkJTeiE3fuwD",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.ETH,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 3,
  },
  FIDA_RAY_V4: {
    symbol: "FIDA-RAY",
    name: "FIDA-RAY V4 LP",
    mint: "DsBuznXRTmzvEdb36Dx3aVLVo1XmH7r1PRZUFugLPTFv",

    base: MAINNET_SPL_TOKENS.FIDA,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.FIDA.decimals,

    version: 4,
  },
  OXY_RAY_V4: {
    symbol: "OXY-RAY",
    name: "OXY-RAY V4 LP",
    mint: "FwaX9W7iThTZH5MFeasxdLpxTVxRcM7ZHieTCnYog8Yb",

    base: MAINNET_SPL_TOKENS.OXY,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.OXY.decimals,

    version: 4,
  },
  MAPS_RAY_V4: {
    symbol: "MAPS-RAY",
    name: "MAPS-RAY V4 LP",
    mint: "CcKK8srfVdTSsFGV3VLBb2YDbzF4T4NM2C3UEjC39RLP",

    base: MAINNET_SPL_TOKENS.MAPS,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.MAPS.decimals,

    version: 4,
  },
  KIN_RAY_V4: {
    symbol: "KIN-RAY",
    name: "KIN-RAY V4 LP",
    mint: "CHT8sft3h3gpLYbCcZ9o27mT5s3Z6VifBVbUiDvprHPW",

    base: MAINNET_SPL_TOKENS.KIN,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: 6,

    version: 4,
  },
  RAY_USDT_V4: {
    symbol: "RAY-USDT",
    name: "RAY-USDT V4 LP",
    mint: "C3sT1R3nsw4AVdepvLTLKr5Gvszr7jufyBWUCvy4TUvT",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.USDT,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 4,
  },
  SOL_USDC_V4: {
    symbol: "SOL-USDC",
    name: "SOL-USDC V4 LP",
    mint: "8HoQnePLqPj4M7PUDzfw8e3Ymdwgc7NLGnaTUapubyvu",

    base: MAINNET_SPL_TOKENS.WSOL,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.WSOL.decimals,

    version: 4,
  },
  YFI_USDC_V4: {
    symbol: "YFI-USDC",
    name: "YFI-USDC V4 LP",
    mint: "865j7iMmRRycSYUXzJ33ZcvLiX9JHvaLidasCyUyKaRE",

    base: MAINNET_SPL_TOKENS.YFI,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.YFI.decimals,

    version: 4,
  },
  SRM_USDC_V4: {
    symbol: "SRM-USDC",
    name: "SRM-USDC V4 LP",
    mint: "9XnZd82j34KxNLgQfz29jGbYdxsYznTWRpvZE3SRE7JG",

    base: MAINNET_SPL_TOKENS.SRM,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.SRM.decimals,

    version: 4,
  },
  FTT_USDC_V4: {
    symbol: "FTT-USDC",
    name: "FTT-USDC V4 LP",
    mint: "75dCoKfUHLUuZ4qEh46ovsxfgWhB4icc3SintzWRedT9",

    base: MAINNET_SPL_TOKENS.FTT,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.FTT.decimals,

    version: 4,
  },
  BTC_USDC_V4: {
    symbol: "BTC-USDC",
    name: "BTC-USDC V4 LP",
    mint: "2hMdRdVWZqetQsaHG8kQjdZinEMBz75vsoWTCob1ijXu",

    base: MAINNET_SPL_TOKENS.BTC,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.BTC.decimals,

    version: 4,
  },
  SUSHI_USDC_V4: {
    symbol: "SUSHI-USDC",
    name: "SUSHI-USDC V4 LP",
    mint: "2QVjeR9d2PbSf8em8NE8zWd8RYHjFtucDUdDgdbDD2h2",

    base: MAINNET_SPL_TOKENS.SUSHI,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.SUSHI.decimals,

    version: 4,
  },
  TOMO_USDC_V4: {
    symbol: "TOMO-USDC",
    name: "TOMO-USDC V4 LP",
    mint: "CHyUpQFeW456zcr5XEh4RZiibH8Dzocs6Wbgz9aWpXnQ",

    base: MAINNET_SPL_TOKENS.TOMO,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.TOMO.decimals,

    version: 4,
  },
  LINK_USDC_V4: {
    symbol: "LINK-USDC",
    name: "LINK-USDC V4 LP",
    mint: "BqjoYjqKrXtfBKXeaWeAT5sYCy7wsAYf3XjgDWsHSBRs",

    base: MAINNET_SPL_TOKENS.LINK,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.LINK.decimals,

    version: 4,
  },
  ETH_USDC_V4: {
    symbol: "ETH-USDC",
    name: "ETH-USDC V4 LP",
    mint: "13PoKid6cZop4sj2GfoBeujnGfthUbTERdE5tpLCDLEY",

    base: MAINNET_SPL_TOKENS.ETH,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.ETH.decimals,

    version: 4,
  },
  xCOPE_USDC_V4: {
    symbol: "xCOPE-USDC",
    name: "xCOPE-USDC V4 LP",
    mint: "2Vyyeuyd15Gp8aH6uKE72c4hxc8TVSLibxDP9vzspQWG",

    base: MAINNET_SPL_TOKENS.xCOPE,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.xCOPE.decimals,

    version: 4,
  },
  SOL_USDT_V4: {
    symbol: "SOL-USDT",
    name: "SOL-USDT V4 LP",
    mint: "Epm4KfTj4DMrvqn6Bwg2Tr2N8vhQuNbuK8bESFp4k33K",

    base: MAINNET_SPL_TOKENS.WSOL,
    quote: MAINNET_SPL_TOKENS.USDT,
    decimals: MAINNET_SPL_TOKENS.WSOL.decimals,

    version: 4,
  },
  YFI_USDT_V4: {
    symbol: "YFI-USDT",
    name: "YFI-USDT V4 LP",
    mint: "FA1i7fej1pAbQbnY8NbyYUsTrWcasTyipKreDgy1Mgku",

    base: MAINNET_SPL_TOKENS.YFI,
    quote: MAINNET_SPL_TOKENS.USDT,
    decimals: MAINNET_SPL_TOKENS.YFI.decimals,

    version: 4,
  },
  SRM_USDT_V4: {
    symbol: "SRM-USDT",
    name: "SRM-USDT V4 LP",
    mint: "HYSAu42BFejBS77jZAZdNAWa3iVcbSRJSzp3wtqCbWwv",

    base: MAINNET_SPL_TOKENS.SRM,
    quote: MAINNET_SPL_TOKENS.USDT,
    decimals: MAINNET_SPL_TOKENS.SRM.decimals,

    version: 4,
  },
  FTT_USDT_V4: {
    symbol: "FTT-USDT",
    name: "FTT-USDT V4 LP",
    mint: "2cTCiUnect5Lap2sk19xLby7aajNDYseFhC9Pigou11z",

    base: MAINNET_SPL_TOKENS.FTT,
    quote: MAINNET_SPL_TOKENS.USDT,
    decimals: MAINNET_SPL_TOKENS.FTT.decimals,

    version: 4,
  },
  BTC_USDT_V4: {
    symbol: "BTC-USDT",
    name: "BTC-USDT V4 LP",
    mint: "DgGuvR9GSHimopo3Gc7gfkbKamLKrdyzWkq5yqA6LqYS",

    base: MAINNET_SPL_TOKENS.BTC,
    quote: MAINNET_SPL_TOKENS.USDT,
    decimals: MAINNET_SPL_TOKENS.BTC.decimals,

    version: 4,
  },
  SUSHI_USDT_V4: {
    symbol: "SUSHI-USDT",
    name: "SUSHI-USDT V4 LP",
    mint: "Ba26poEYDy6P2o95AJUsewXgZ8DM9BCsmnU9hmC9i4Ki",

    base: MAINNET_SPL_TOKENS.SUSHI,
    quote: MAINNET_SPL_TOKENS.USDT,
    decimals: MAINNET_SPL_TOKENS.SUSHI.decimals,

    version: 4,
  },
  TOMO_USDT_V4: {
    symbol: "TOMO-USDT",
    name: "TOMO-USDT V4 LP",
    mint: "D3iGro1vn6PWJXo9QAPj3dfta6dKkHHnmiiym2EfsAmi",

    base: MAINNET_SPL_TOKENS.TOMO,
    quote: MAINNET_SPL_TOKENS.USDT,
    decimals: MAINNET_SPL_TOKENS.TOMO.decimals,

    version: 4,
  },
  LINK_USDT_V4: {
    symbol: "LINK-USDT",
    name: "LINK-USDT V4 LP",
    mint: "Dr12Sgt9gkY8WU5tRkgZf1TkVWJbvjYuPAhR3aDCwiiX",

    base: MAINNET_SPL_TOKENS.LINK,
    quote: MAINNET_SPL_TOKENS.USDT,
    decimals: MAINNET_SPL_TOKENS.LINK.decimals,

    version: 4,
  },
  ETH_USDT_V4: {
    symbol: "ETH-USDT",
    name: "ETH-USDT V4 LP",
    mint: "nPrB78ETY8661fUgohpuVusNCZnedYCgghzRJzxWnVb",

    base: MAINNET_SPL_TOKENS.ETH,
    quote: MAINNET_SPL_TOKENS.USDT,
    decimals: MAINNET_SPL_TOKENS.ETH.decimals,

    version: 4,
  },
  YFI_SRM_V4: {
    symbol: "YFI-SRM",
    name: "YFI-SRM V4 LP",
    mint: "EGJht91R7dKpCj8wzALkjmNdUUUcQgodqWCYweyKcRcV",

    base: MAINNET_SPL_TOKENS.YFI,
    quote: MAINNET_SPL_TOKENS.SRM,
    decimals: MAINNET_SPL_TOKENS.YFI.decimals,

    version: 4,
  },
  FTT_SRM_V4: {
    symbol: "FTT-SRM",
    name: "FTT-SRM V4 LP",
    mint: "AsDuPg9MgPtt3jfoyctUCUgsvwqAN6RZPftqoeiPDefM",

    base: MAINNET_SPL_TOKENS.FTT,
    quote: MAINNET_SPL_TOKENS.SRM,
    decimals: MAINNET_SPL_TOKENS.FTT.decimals,

    version: 4,
  },
  BTC_SRM_V4: {
    symbol: "BTC-SRM",
    name: "BTC-SRM V4 LP",
    mint: "AGHQxXb3GSzeiLTcLtXMS2D5GGDZxsB2fZYZxSB5weqB",

    base: MAINNET_SPL_TOKENS.BTC,
    quote: MAINNET_SPL_TOKENS.SRM,
    decimals: MAINNET_SPL_TOKENS.BTC.decimals,

    version: 4,
  },
  SUSHI_SRM_V4: {
    symbol: "SUSHI-SRM",
    name: "SUSHI-SRM V4 LP",
    mint: "3HYhUnUdV67j1vn8fu7ExuVGy5dJozHEyWvqEstDbWwE",

    base: MAINNET_SPL_TOKENS.SUSHI,
    quote: MAINNET_SPL_TOKENS.SRM,
    decimals: MAINNET_SPL_TOKENS.SUSHI.decimals,

    version: 4,
  },
  TOMO_SRM_V4: {
    symbol: "TOMO-SRM",
    name: "TOMO-SRM V4 LP",
    mint: "GgH9RnKrQpaMQeqmdbMvs5oo1A24hERQ9wuY2pSkeG7x",

    base: MAINNET_SPL_TOKENS.TOMO,
    quote: MAINNET_SPL_TOKENS.SRM,
    decimals: MAINNET_SPL_TOKENS.TOMO.decimals,

    version: 4,
  },
  LINK_SRM_V4: {
    symbol: "LINK-SRM",
    name: "LINK-SRM V4 LP",
    mint: "GXN6yJv12o18skTmJXaeFXZVY1iqR18CHsmCT8VVCmDD",

    base: MAINNET_SPL_TOKENS.LINK,
    quote: MAINNET_SPL_TOKENS.SRM,
    decimals: MAINNET_SPL_TOKENS.LINK.decimals,

    version: 4,
  },
  ETH_SRM_V4: {
    symbol: "ETH-SRM",
    name: "ETH-SRM V4 LP",
    mint: "9VoY3VERETuc2FoadMSYYizF26mJinY514ZpEzkHMtwG",

    base: MAINNET_SPL_TOKENS.ETH,
    quote: MAINNET_SPL_TOKENS.SRM,
    decimals: MAINNET_SPL_TOKENS.ETH.decimals,

    version: 4,
  },
  SRM_SOL_V4: {
    symbol: "SRM-SOL",
    name: "SRM-SOL V4 LP",
    mint: "AKJHspCwDhABucCxNLXUSfEzb7Ny62RqFtC9uNjJi4fq",

    base: MAINNET_SPL_TOKENS.SRM,
    quote: MAINNET_SPL_TOKENS.WSOL,
    decimals: MAINNET_SPL_TOKENS.SRM.decimals,

    version: 4,
  },
  STEP_USDC_V4: {
    symbol: "STEP-USDC",
    name: "STEP-USDC V4 LP",
    mint: "3k8BDobgihmk72jVmXYLE168bxxQUhqqyESW4dQVktqC",

    base: MAINNET_SPL_TOKENS.STEP,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.STEP.decimals,

    version: 4,
  },
  MEDIA_USDC_V4: {
    symbol: "MEDIA-USDC",
    name: "MEDIA-USDC V4 LP",
    mint: "A5zanvgtioZGiJMdEyaKN4XQmJsp1p7uVxaq2696REvQ",

    base: MAINNET_SPL_TOKENS.MEDIA,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.MEDIA.decimals,

    version: 4,
  },
  ROPE_USDC_V4: {
    symbol: "ROPE-USDC",
    name: "ROPE-USDC V4 LP",
    mint: "Cq4HyW5xia37tKejPF2XfZeXQoPYW6KfbPvxvw5eRoUE",

    base: MAINNET_SPL_TOKENS.ROPE,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.ROPE.decimals,

    version: 4,
  },
  MER_USDC_V4: {
    symbol: "MER-USDC",
    name: "MER-USDC V4 LP",
    mint: "3H9NxvaZoxMZZDZcbBDdWMKbrfNj7PCF5sbRwDr7SdDW",

    base: MAINNET_SPL_TOKENS.MER,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.MER.decimals,

    version: 4,
  },
  COPE_USDC_V4: {
    symbol: "COPE-USDC",
    name: "COPE-USDC V4 LP",
    mint: "Cz1kUvHw98imKkrqqu95GQB9h1frY8RikxPojMwWKGXf",

    base: MAINNET_SPL_TOKENS.COPE,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.COPE.decimals,

    version: 4,
  },
  ALEPH_USDC_V4: {
    symbol: "ALEPH-USDC",
    name: "ALEPH-USDC V4 LP",
    mint: "iUDasAP2nXm5wvTukAHEKSdSXn8vQkRtaiShs9ceGB7",

    base: MAINNET_SPL_TOKENS.ALEPH,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.ALEPH.decimals,

    version: 4,
  },
  TULIP_USDC_V4: {
    symbol: "TULIP-USDC",
    name: "TULIP-USDC V4 LP",
    mint: "2doeZGLJyACtaG9DCUyqMLtswesfje1hjNA11hMdj6YU",

    base: MAINNET_SPL_TOKENS.TULIP,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.TULIP.decimals,

    version: 4,
  },
  WOO_USDC_V4: {
    symbol: "WOO-USDC",
    name: "WOO-USDC V4 LP",
    mint: "7cu42ao8Jgrd5A3y3bNQsCxq5poyGZNmTydkGfJYQfzh",

    base: MAINNET_SPL_TOKENS.WOO,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.WOO.decimals,

    version: 4,
  },
  SNY_USDC_V4: {
    symbol: "SNY-USDC",
    name: "SNY-USDC V4 LP",
    mint: "G8qcfeFqxwbCqpxv5LpLWxUCd1PyMB5nWb5e5YyxLMKg",

    base: MAINNET_SPL_TOKENS.SNY,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.SNY.decimals,

    version: 4,
  },
  BOP_RAY_V4: {
    symbol: "BOP-RAY",
    name: "BOP-RAY V4 LP",
    mint: "9nQPYJvysyfnXhQ6nkK5V7sZG26hmDgusfdNQijRk5LD",

    base: MAINNET_SPL_TOKENS.BOP,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.BOP.decimals,

    version: 4,
  },
  SLRS_USDC_V4: {
    symbol: "SLRS-USDC",
    name: "SLRS-USDC V4 LP",
    mint: "2Xxbm1hdv5wPeen5ponDSMT3VqhGMTQ7mH9stNXm9shU",

    base: MAINNET_SPL_TOKENS.SLRS,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.SLRS.decimals,

    version: 4,
  },
  SAMO_RAY_V4: {
    symbol: "SAMO-RAY",
    name: "SAMO-RAY V4 LP",
    mint: "HwzkXyX8B45LsaHXwY8su92NoRBS5GQC32HzjQRDqPnr",

    base: MAINNET_SPL_TOKENS.SAMO,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.SAMO.decimals,

    version: 4,
  },
  renBTC_USDC_V4: {
    symbol: "renBTC-USDC",
    name: "renBTC-USDC V4 LP",
    mint: "CTEpsih91ZLo5gunvryLpJ3pzMjmt5jbS6AnSQrzYw7V",

    base: MAINNET_SPL_TOKENS.renBTC,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.renBTC.decimals,

    version: 4,
  },
  renDOGE_USDC_V4: {
    symbol: "renDOGE-USDC",
    name: "renDOGE-USDC V4 LP",
    mint: "Hb8KnZNKvRxu7pgMRWJgoMSMcepfvNiBFFDDrdf9o3wA",

    base: MAINNET_SPL_TOKENS.renDOGE,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.renDOGE.decimals,

    version: 4,
  },
  RAY_USDC_V4: {
    symbol: "RAY-USDC",
    name: "RAY-USDC V4 LP",
    mint: "FbC6K13MzHvN42bXrtGaWsvZY9fxrackRSZcBGfjPc7m",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 4,
  },
  RAY_SRM_V4: {
    symbol: "RAY-SRM",
    name: "RAY-SRM V4 LP",
    mint: "7P5Thr9Egi2rvMmEuQkLn8x8e8Qro7u2U7yLD2tU2Hbe",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.SRM,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 4,
  },
  RAY_ETH_V4: {
    symbol: "RAY-ETH",
    name: "RAY-ETH V4 LP",
    mint: "mjQH33MqZv5aKAbKHi8dG3g3qXeRQqq1GFcXceZkNSr",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.ETH,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 4,
  },
  RAY_SOL_V4: {
    symbol: "RAY-SOL",
    name: "RAY-SOL V4 LP",
    mint: "89ZKE4aoyfLBe2RuV6jM3JGNhaV18Nxh8eNtjRcndBip",

    base: MAINNET_SPL_TOKENS.RAY,
    quote: MAINNET_SPL_TOKENS.WSOL,
    decimals: MAINNET_SPL_TOKENS.RAY.decimals,

    version: 4,
  },
  DXL_USDC_V4: {
    symbol: "DXL-USDC",
    name: "DXL-USDC V4 LP",
    mint: "4HFaSvfgskipvrzT1exoVKsUZ174JyExEsA8bDfsAdY5",

    base: MAINNET_SPL_TOKENS.DXL,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.DXL.decimals,

    version: 4,
  },
  LIKE_USDC_V4: {
    symbol: "LIKE-USDC",
    name: "LIKE-USDC V4 LP",
    mint: "cjZmbt8sJgaoyWYUttomAu5LJYU44ZrcKTbzTSEPDVw",

    base: MAINNET_SPL_TOKENS.LIKE,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.LIKE.decimals,

    version: 4,
  },
  mSOL_USDC_V4: {
    symbol: "mSOL-USDC",
    name: "mSOL-USDC V4 LP",
    mint: "4xTpJ4p76bAeggXoYywpCCNKfJspbuRzZ79R7pRhbqSf",

    base: MAINNET_SPL_TOKENS.mSOL,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.mSOL.decimals,

    version: 4,
  },
  mSOL_SOL_V4: {
    symbol: "mSOL-SOL",
    name: "mSOL-SOL V4 LP",
    mint: "5ijRoAHVgd5T5CNtK5KDRUBZ7Bffb69nktMj5n6ks6m4",

    base: MAINNET_SPL_TOKENS.mSOL,
    quote: MAINNET_SPL_TOKENS.WSOL,
    decimals: MAINNET_SPL_TOKENS.mSOL.decimals,

    version: 4,
  },
  MER_PAI_V4: {
    symbol: "MER-PAI",
    name: "MER-PAI V4 LP",
    mint: "DU5RT2D9EviaSmX6Ta8MZwMm85HwSEqGMRdqUiuCGfmD",

    base: MAINNET_SPL_TOKENS.MER,
    quote: MAINNET_SPL_TOKENS.PAI,
    decimals: MAINNET_SPL_TOKENS.MER.decimals,

    version: 4,
  },
  PORT_USDC_V4: {
    symbol: "PORT-USDC",
    name: "PORT-USDC V4 LP",
    mint: "9tmNtbUCrLS15qC4tEfr5NNeqcqpZ4uiGgi2vS5CLQBS",

    base: MAINNET_SPL_TOKENS.PORT,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.PORT.decimals,

    version: 4,
  },
  MNGO_USDC_V4: {
    symbol: "MNGO-USDC",
    name: "MNGO-USDC V4 LP",
    mint: "DkiqCQ792n743xjWQVCbBUaVtkdiuvQeYndM53ReWnCC",

    base: MAINNET_SPL_TOKENS.MNGO,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.MNGO.decimals,

    version: 4,
  },
  ALEPH_RAY_V4: {
    symbol: "ALEPH-RAY",
    name: "ALEPH-RAY V4 LP",
    mint: "n76skjqv4LirhdLok2zJELXNLdRpYDgVJQuQFbamscy",

    base: MAINNET_SPL_TOKENS.ALEPH,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.ALEPH.decimals,

    version: 4,
  },
  TULIP_RAY_V4: {
    symbol: "TULIP-RAY",
    name: "TULIP-RAY V4 LP",
    mint: "3AZTviji5qduMG2s4FfWGR3SSQmNUCyx8ao6UKCPg3oJ",

    base: MAINNET_SPL_TOKENS.TULIP,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.TULIP.decimals,

    version: 4,
  },
  SLRS_RAY_V4: {
    symbol: "SLRS-RAY",
    name: "SLRS-RAY V4 LP",
    mint: "2pk78vsKT3jfJAcN2zbpMUnrR57SZrxHqaZYyFgp92mM",

    base: MAINNET_SPL_TOKENS.SLRS,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.SLRS.decimals,

    version: 4,
  },
  MER_RAY_V4: {
    symbol: "MER-RAY",
    name: "MER-RAY V4 LP",
    mint: "214hxy3AbKoaEKgqcg2aC1cP5R67cGGAyDEg5GDwC7Ub",

    base: MAINNET_SPL_TOKENS.MER,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.MER.decimals,

    version: 4,
  },
  MEDIA_RAY_V4: {
    symbol: "MEDIA-RAY",
    name: "MEDIA-RAY V4 LP",
    mint: "9Aseg5A1JD1yCiFFdDaNNxCiJ7XzrpZFmcEmLjXFdPaH",

    base: MAINNET_SPL_TOKENS.MEDIA,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.MEDIA.decimals,

    version: 4,
  },
  SNY_RAY_V4: {
    symbol: "SNY-RAY",
    name: "SNY-RAY V4 LP",
    mint: "2k4quTuuLUxrSEhFH99qcoZzvgvVEc3b5sz3xz3qstfS",

    base: MAINNET_SPL_TOKENS.SNY,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.SNY.decimals,

    version: 4,
  },
  LIKE_RAY_V4: {
    symbol: "LIKE-RAY",
    name: "LIKE-RAY V4 LP",
    mint: "7xqDycbFSCpUpzkYapFeyPJWPwEpV7zdWbYf2MVHTNjv",

    base: MAINNET_SPL_TOKENS.LIKE,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.LIKE.decimals,

    version: 4,
  },
  COPE_RAY_V4: {
    symbol: "COPE-RAY",
    name: "COPE-RAY V4 LP",
    mint: "A7GCVHA8NSsbdFscHdoNU41tL1TRKNmCH4K94CgcLK9F",

    base: MAINNET_SPL_TOKENS.COPE,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.COPE.decimals,

    version: 4,
  },
  ATLAS_USDC_V4: {
    symbol: "ATLAS-USDC",
    name: "ATLAS-USDC V4 LP",
    mint: "9shGU9f1EsxAbiR567MYZ78WUiS6ZNCYbHe53WUULQ7n",

    base: MAINNET_SPL_TOKENS.ATLAS,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.ATLAS.decimals,

    version: 4,
  },
  POLIS_USDC_V4: {
    symbol: "POLIS-USDC",
    name: "POLIS-USDC V4 LP",
    mint: "8MbKSBpyXs8fVneKgt71jfHrn5SWtX8n4wMLpiVfF9So",

    base: MAINNET_SPL_TOKENS.POLIS,
    quote: MAINNET_SPL_TOKENS.USDC,
    decimals: MAINNET_SPL_TOKENS.POLIS.decimals,

    version: 4,
  },
  ATLAS_RAY_V4: {
    symbol: "ATLAS-RAY",
    name: "ATLAS-RAY V4 LP",
    mint: "418MFhkaYQtbn529wmjLLqL6uKxDz7j4eZBaV1cobkyd",

    base: MAINNET_SPL_TOKENS.ATLAS,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.ATLAS.decimals,

    version: 4,
  },
  POLIS_RAY_V4: {
    symbol: "POLIS-RAY",
    name: "POLIS-RAY V4 LP",
    mint: "9ysGKUH6WqzjQEUT4dxqYCUaFNVK9QFEa24pGzjFq8xg",

    base: MAINNET_SPL_TOKENS.POLIS,
    quote: MAINNET_SPL_TOKENS.RAY,
    decimals: MAINNET_SPL_TOKENS.POLIS.decimals,

    version: 4,
  },
};
