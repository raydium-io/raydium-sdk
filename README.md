# Raydium SDK

[npm-image]: https://img.shields.io/npm/v/@raydium-io/raydium-sdk.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@raydium-io/raydium-sdk

[![npm][npm-image]][npm-url]

An SDK for building applications on top of Raydium.

## Installation

### Yarn

```
$ yarn add @raydium-io/raydium-sdk
```

### npm

```
$ npm install @raydium-io/raydium-sdk --save
```

## Hosting JSON files

### Tokens List

- Solana format: https://api.raydium.io/v2/sdk/token/solana.mainnet.json
- Raydium format: https://api.raydium.io/v2/sdk/token/raydium.mainnet.json

### Token Icons

- /icons/{mint}.png

### Liquidity Pools List

**_Includes all pubkeys that build transaction need_**

- https://api.raydium.io/v2/sdk/liquidity/mainnet.json

### Farm/Staking Pools List

**_Includes all pubkeys that build transaction need_**

- https://api.raydium.io/v2/sdk/farm/mainnet.json

## Program IDs

| Function        | Version | Mainnet                                      |
| --------------- | ------- | -------------------------------------------- |
| AMM / Liquidity | 4       | 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8 |
| Farm / Staking  | 3       | EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q |
| Farm / Staking  | 5       | 9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4z |
| AMM Route       | 1       | routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS  |
| Serum           | 3       | 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin |

## Usage

### Marshmallow

**_Full layout type inference_**

![](snapshots/marshmallow/1.png)
![](snapshots/marshmallow/2.png)

## Development

```
yarn install && yarn install-peers
```

## Reference

- https://github.com/ethers-io/ethers.js/tree/master/packages/bignumber
- https://github.com/pancakeswap/pancake-swap-sdk
- https://github.com/project-serum/serum-ts
- https://yarnpkg.com/advanced/lifecycle-scripts
