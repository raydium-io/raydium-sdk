# Changelog

### 1.0.1-beta.17 (2022-01-10)

- Add
  - `makeSwapFixedOutInstructionV4` for `Liquidity`
- Change
  - Rename `makeSwapInstructionV4` to `makeSwapFixedInInstructionV4` of `Liquidity`
  - Rename params `side` to `tradeSide` of `Liquidity.makeSwapInstruction`
  - Update dev dependencies

### 1.0.1-beta.15 (2022-01-09)

- Add
  - `getQuote` for `Liquidity`
  - `getAmountB` for `Liquidity`
  - `getAmountOut` for `Liquidity`
  - `getAmountIn` for `Liquidity`
- Change
  - Rename `getOutputAmount` to `getAmountOut` of `Liquidity`
  - Update dev dependencies

### 1.0.1-beta.14 (2021-12-21)

- Change
  - Fix `pendingRewards` calculating for `Farm` stake pool

### 1.0.1-beta.11 (2021-12-17)

- Add
  - ledger PDA for `Farm v3`
- Change
  - Raising the priority of `version` parameters
  - Return `Object` instead of `Array` whenever possible, but the order of the `Object` will be consistent with the `Array`, use a unique value for the key, such as `id` or `mint` or something else, etc.
  - Don't calculate ATA / PDA in function
  - Rename type `PublicKeyIsh` to `PublicKeyish`
  - Rename type `BigNumberIsh` to `BigNumberish`
  - Rename `marketVaultSigner` to `marketAuthority` for `poolKeys`
  - Rename `getAssociatedVaultSigner` to `getAssociatedAuthority` for `Market`
  - Update dev dependencies

### 1.0.1-beta.10 (2021-12-11)

- Change
  - Fix `Spl` functions amount params
  - Update dev dependencies

### 1.0.1-beta.9 (2021-12-08)

- Add
  - `makeCreatePoolInstruction` and `makeInitPoolInstruction` for `Liquidity`
- Change
  - Rename all getAssociated functions
  - Rename `tempLpVault` to `lpVault`
  - Rename `getAssociatedTokenAddress` to `getAssociatedTokenAccount` of `Spl`
  - Return `nonce` for `Liquidity.getAssociatedAuthority`
  - Fix `Farm` ledger PDA
  - Update dev dependencies

### 1.0.1-beta.8 (2021-12-07)

- Add
  - getMultipleInfo for `Liquidity`
- Change
  - Fix `Farm` v5 instructions
  - Update dev dependencies

### 1.0.1-beta.7 (2021-12-05)

- Add
  - Calculate `pendingRewards` for `Farm.getMultipleInfo`
- Change
  - Fix `Farm` ledger PDA algorithm
  - Fix `Farm` layout versions
  - Update dev dependencies

### 1.0.1-beta.6 (2021-12-02)

- Change
  - Fix typo

### 1.0.1-beta.5 (2021-12-02)

- Add
  - `poolKeys2JsonInfo` (convert poolKeys to JsonInfo)
- Change
  - Fix `CurrencyAmount`
  - Update dev dependencies

### 1.0.1-beta.4 (2021-11-29)

- Add
  - `getOutputAmount` static function for `Liquidity`
- Change
  - Rename and change the types of `MAINNET_LIQUIDITY_POOLS`, `TESTNET_LIQUIDITY_POOLS`, `DEVNET_LIQUIDITY_POOLS`
  - Return variable names of `Liquidity.getInfo`: `baseBalance` to `baseReserve`, `quoteBalance` to `quoteReserve`

### 1.0.1-beta.3 (2021-11-28)

- Add
  - `getPools` static function for `Liquidity` (fetch pools on-chain)
- Change
  - Flat params of `Liquidity.getInfo`
  - Rename all layouts types
  - Change version types to `number` in all `poolKeys`
  - Update peer dependencies
  - Update dev dependencies
- Remove
  - `getInfo` static function for `Liquidity`

### 1.0.1-beta.1 (2021-11-21)

- Add
  - `getInfo` static function for `Liquidity` (simulate way)
- Change
  - Update dev dependencies

### 1.0.1-beta.0 (2021-11-19)

- Add
  - `isRaw` param for `TokenAmount`
- Change
  - Directory tree
  - Exported program ids as `PublicKey`
  - Update dev dependencies
