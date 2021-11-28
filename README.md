# Raydium SDK

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

- Solana format: https://sdk.raydium.io/token/solana.mainnet.json
- Raydium format: https://sdk.raydium.io/token/raydium.mainnet.json

### Token Icons

- https://sdk.raydium.io/icons/{mint}.png

### Liquidity Pools List

**_Includes all pubkeys that build transaction need_**

- https://sdk.raydium.io/liquidity/mainnet.json

### Farm/Staking Pools List

**_Includes all pubkeys that build transaction need_**

- https://sdk.raydium.io/farm/mainnet.json

## Usage

### Marshmallow

**_Complete layout type inference_**

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
