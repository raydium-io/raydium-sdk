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

```javascript
import { Raydium } from "@raydium-io/raydium-sdk";

const raydium = await Raydium.load({
  connection,
});
```

### Enable special logger

```javascript
import { setLoggerLevel } from "@raydium-io/raydium-sdk";

setLoggerLevel("Common.Api", "debug");
```

## Features

### Marshmallow

**_Full layout type inference_**

![](snapshots/marshmallow/1.png)
![](snapshots/marshmallow/2.png)

### Initialization

```
import { Raydium } from '@raydium-io/raydium-sdk'
const raydium = await Raydium.load({
  connection,
  owner, // key pair or publicKey
  signAllTransactions, // optional - provide sign functions provided by @solana/wallet-adapter-react
  tokenAccounts, // optional, if dapp handle it by self can provide to sdk
  tokenAccountRowInfos // optional, if dapp handle it by self can provide to sdk
})
```

#### how to transform token account data

```
import { parseTokenAccountResp } from '@raydium-io/raydium-sdk'

const solAccountResp = await connection.getAccountInfo(ownerPubKey);
const tokenAccountResp = await connection.getTokenAccountsByOwner(
  ownerPubKey,
  { programId: TOKEN_PROGRAM_ID },
);

const { tokenAccounts, tokenAccountRawInfos } = parseTokenAccountResp({
  solAccountResp,
  tokenAccountResp,
})
```

#### data after initialization

```
# token
raydium.token.allTokens
raydium.token.allTokenMap

# liquidity pool
raydium.liquidity.allPools
raydium.liquidity.allPoolIdSet

# farm pool
raydium.farm.allFarms
raydium.farm.allParsedFarms

# token account
raydium.account.tokenAccounts
raydium.account.tokenAccountRawInfos
```

### Liquidity

```
import { Raydium, Token, Percent, TokenAmount } from '@raydium-io/raydium-sdk'
import BN from 'bn.js'

const raydium = await Raydium.load({
  connection,
  owner // please provide key pair, if want to handle tx by yourself, just provide publicKey
  signAllTransactions // optional - provide sign functions provided by @solana/wallet-adapter-react
})

raydium.liquidity.createPool()
raydium.liquidity.initPool()
raydium.liquidity.addLiquidity()
raydium.liquidity.removeLiquidity()
```

### Farm

```
import { Raydium, Token, Percent, TokenAmount } from '@raydium-io/raydium-sdk'
import BN from 'bn.js'

const raydium = await Raydium.load({
  connection,
  owner // please provide key pair, if want to handle tx by yourself, just provide publicKey
  signAllTransactions // optional - provide sign functions provided by @solana/wallet-adapter-react
})

raydium.farm.create({ poolId, rewardInfos })
raydium.farm.restartReward({ farmId, rewardInfos: [] })
raydium.farm.addNewRewardToken({ poolId, newRewardInfo: [] })
raydium.farm.deposit({ farmId, amount })
raydium.farm.withdraw({ farmId, amount })
raydium.farm.withdraw({ farmId, withdrawMint: new PublicKey(xxx) })
```

### Swap

```
import { Raydium, Token, Percent, TokenAmount } from '@raydium-io/raydium-sdk'
import BN from 'bn.js'

const raydium = Raydium.load({
  connection,
  owner // please provide key pair, if want to handle tx by yourself, just provide publicKey
  signAllTransactions // optional - provide sign functions provided by @solana/wallet-adapter-react
})
```

#### direct swap with automatically routes

```
const { transaction, signers, excute } = await raydium.trade.directSwap({
  inputMint: ${rayMint},
  outputMint: "sol", // due to sol doesn't have mint, so raydium accept sol as mint
  amountIn: "1.2345",
  slippage: new Percent(5, 100),
  fixedSide: "in"
})

const txId = excute()
```

#### custom controlled route swap

```
const { availablePools, best, routedPools } = await raydium.trade.getAvailablePools({
  inputMint: ${rayMint},
  outputMint: "sol",
})

const inputToken = raydium.token.mintToToken("4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6Rdecimals")
// or use new Token({ mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6Rdecimals: 6, name: "Raydium", symbol: "RAY" })
const outToken = raydium.token.mintToToken("sol")
// or use new Token({ mint: "sol" }) <= sdk will generate wsol token automatically

const { amountOut, minAmountOut, routes, routeType } =
  await raydium.swap.getBestAmountOut({
  pools: routedPools, // optional, if not passed, will auto choose best route
  inputToken: inputToken,
  outputToken: outToken,
  amountIn: '1.2345', // or new BN("1,2345");
  slippage: new Percent(10, 100) // 10%
})

const { transaction, signers, execute } = await raydium.trade.swap({
  routes,
  routeType,
  amountIn: new TokenAmount(raydium.token.mintToToken(${rayMint}), "1.2345"),
  amountOut: minAmountOut,
  fixedSide: "in"
})

const txId = excute()
```

## Reference

- https://github.com/coral-xyz/anchor/tree/master/ts
- https://github.com/ethers-io/ethers.js/tree/master/packages/bignumber
- https://github.com/pancakeswap/pancake-swap-sdk
- https://github.com/project-serum/serum-ts
- https://yarnpkg.com/advanced/lifecycle-scripts
