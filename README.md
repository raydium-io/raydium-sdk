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

#### Example of parse pool info

```
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  TokenAccount,
  SPL_ACCOUNT_LAYOUT,
  LIQUIDITY_STATE_LAYOUT_V4,
} from "@raydium-io/raydium-sdk";
import { OpenOrders } from "@project-serum/serum";
import BN from "bn.js";

async function getTokenAccounts(connection: Connection, owner: PublicKey) {
  const tokenResp = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const accounts: TokenAccount[] = [];
  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
    });
  }

  return accounts;
}

// raydium pool id can get from api: https://api.raydium.io/v2/sdk/liquidity/mainnet.json
const SOL_USDC_POOL_ID = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";
const OPENBOOK_PROGRAM_ID = new PublicKey(
  "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"
);

export async function parsePoolInfo() {
  const connection = new Connection({mainnect rpc node}, "confirmed");
  const owner = new PublicKey("FQXYQXaNkc8K469KkU3nsQzNFfPo3woX726MrCG9EXum");

  const tokenAccounts = await getTokenAccounts(connection, owner);

  // example to get pool info
  const info = await connection.getAccountInfo(new PublicKey(SOL_USDC_POOL_ID));
  if (!info) return;

  const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);
  const openOrders = await OpenOrders.load(
    connection,
    poolState.openOrders,
    OPENBOOK_PROGRAM_ID // OPENBOOK_PROGRAM_ID(marketProgramId) of each pool can get from api: https://api.raydium.io/v2/sdk/liquidity/mainnet.json
  );

  const baseDecimal = 10 ** poolState.baseDecimal.toNumber(); // e.g. 10 ^ 6
  const quoteDecimal = 10 ** poolState.quoteDecimal.toNumber();

  const baseTokenAmount = await connection.getTokenAccountBalance(
    poolState.baseVault
  );
  const quoteTokenAmount = await connection.getTokenAccountBalance(
    poolState.quoteVault
  );

  const basePnl = poolState.baseNeedTakePnl.toNumber() / baseDecimal;
  const quotePnl = poolState.quoteNeedTakePnl.toNumber() / quoteDecimal;

  const openOrdersBaseTokenTotal =
    openOrders.baseTokenTotal.toNumber() / baseDecimal;
  const openOrdersQuoteTokenTotal =
    openOrders.quoteTokenTotal.toNumber() / quoteDecimal;

  const base =
    (baseTokenAmount.value?.uiAmount || 0) + openOrdersBaseTokenTotal - basePnl;
  const quote =
    (quoteTokenAmount.value?.uiAmount || 0) +
    openOrdersQuoteTokenTotal -
    quotePnl;

  const denominator = new BN(10).pow(poolState.baseDecimal);

  const addedLpAccount = tokenAccounts.find((a) =>
    a.accountInfo.mint.equals(poolState.lpMint)
  );

  console.log(
    "SOL_USDC pool info:",
    "pool total base " + base,
    "pool total quote " + quote,

    "base vault balance " + baseTokenAmount.value.uiAmount,
    "quote vault balance " + quoteTokenAmount.value.uiAmount,

    "base tokens in openorders " + openOrdersBaseTokenTotal,
    "quote tokens in openorders  " + openOrdersQuoteTokenTotal,

    "base token decimals " + poolState.baseDecimal.toNumber(),
    "quote token decimals " + poolState.quoteDecimal.toNumber(),
    "total lp " + poolState.lpReserve.div(denominator).toString(),

    "addedLpAmount " +
      (addedLpAccount?.accountInfo.amount.toNumber() || 0) / baseDecimal
  );
}

parsePoolInfo();
```

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
