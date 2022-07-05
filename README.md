# Raydium SDK

[npm-image]: https://img.shields.io/npm/v/@raydium-io/raydium-sdk.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@raydium-io/raydium-sdk

[![npm][npm-image]][npm-url]

An SDK for building applications on top of Raydium.

## Usage Guide

### Installation

```
$ yarn add @raydium-io/raydium-sdk
```

### Load the Raydium instance

```
const raydium = await Raydium.load({
  connection,
});
```

## Features

### Marshmallow

**_Full layout type inference_**

![](snapshots/marshmallow/1.png)
![](snapshots/marshmallow/2.png)

## Reference

- https://github.com/coral-xyz/anchor/tree/master/ts
- https://github.com/ethers-io/ethers.js/tree/master/packages/bignumber
- https://github.com/pancakeswap/pancake-swap-sdk
- https://github.com/project-serum/serum-ts
- https://yarnpkg.com/advanced/lifecycle-scripts
