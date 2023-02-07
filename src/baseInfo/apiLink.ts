export type API_LINK = {
  time: string,
  info: string,
  pairs: string,
  price: string,
  rpcs: string,
  version: string,
  farmApr: string,
  farmAprLine: string,

  tokenInfo: string,
  poolInfo: string,
  farmInfo: string,
  idoInfo: string,
  idoProjectInfo: string,

  // CLMM
  ammV3Pools: string,
  ammV3Configs: string,
  ammV3PositionLine: string,
}
export type API_LINK_MAINNET = typeof RAYDIUM_MAINNET
export type API_LINK_DEVNET = typeof RAYDIUM_DEVNET
export const ENDPOINT = 'https://api.raydium.io'

export const RAYDIUM_MAINNET = {
  time: '/v2/main/chain/time',
  info: '/v2/main/info',
  pairs: '/v2/main/pairs',
  price: '/v2/main/price',
  rpcs: '/v2/main/rpcs',
  version: '/v2/main/version',
  farmApr: '/v2/main/farm/info',
  farmAprLine: '/v2/main/farm-apr-tv',
  tokenInfo: '/v2/sdk/token/raydium.mainnet.json',
  poolInfo: '/v2/sdk/liquidity/mainnet.json',
  farmInfo: '/v2/sdk/farm-v2/mainnet.json',
  idoInfo: '/v2/main/ido/pools',
  idoProjectInfo: '/v2/main/ido/project/<id>',
  // CLMM
  ammV3Pools: '/v2/ammV3/ammPools',
  ammV3Configs: '/v2/ammV3/ammConfigs',
  ammV3PositionLine: '/v2/ammV3/positionLine/<poolId>'
} as const satisfies API_LINK

export const RAYDIUM_DEVNET = {
  time: '/v2/main/chain/time1111',
  info: '/v2/main/info',
  pairs: '/v2/main/pairs',
  price: '/v2/main/price',
  rpcs: '/v2/main/rpcs',
  version: '/v2/main/version',
  farmApr: '/v2/main/farm/info',
  farmAprLine: '/v2/main/farm-apr-tv',
  tokenInfo: '/v2/sdk/token/raydium.mainnet.json',
  poolInfo: '/v2/sdk/liquidity/mainnet.json',
  farmInfo: '/v2/sdk/farm-v2/mainnet.json',
  idoInfo: '/v2/main/ido/pools',
  idoProjectInfo: '/v2/main/ido/project/<id>',
  // CLMM
  ammV3Pools: '/v2/ammV3/ammPools',
  ammV3Configs: '/v2/ammV3/ammConfigs',
  ammV3PositionLine: '/v2/ammV3/positionLine/<poolId>'
} as const satisfies API_LINK