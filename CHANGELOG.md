# Changelog

### 1.0.1-beta.7 (2021-12-05)

- Add
  - Calculate `pendingRewards` for `Farm.getMultipleInfo`
- Change
  - Fix `Farm` ledger PDA algorithm
  - Fix `Farm` layout versions
  - Update dependencies

### 1.0.1-beta.6 (2021-12-02)

- Change
  - Fix typo

### 1.0.1-beta.5 (2021-12-02)

- Add
  - `poolKeys2JsonInfo` (convert poolKeys to JsonInfo)
- Change
  - Fix `CurrencyAmount`
  - Update dependencies

### 1.0.1-beta.4 (2021-11-29)

- Add
  - `getOutputAmount` static function for `Liquidity`
- Change
  - Rename and change the types of `MAINNET_LIQUIDITY_POOLS`, `TESTNET_LIQUIDITY_POOLS`, `DEVNET_LIQUIDITY_POOLS`
  - Return variable names of `Liquidity.getInfo`: `baseBalance` -> `baseReserve`, `quoteBalance` -> `quoteReserve`

### 1.0.1-beta.3 (2021-11-28)

- Add
  - `getPools` static function for `Liquidity` (fetch pools on-chain)
- Change
  - Flat params of `Liquidity.getInfo`
  - Rename all layouts types
  - Change version types to `number` in all `poolKeys`
  - Update dependencies

### 1.0.1-beta.1 (2021-11-21)

- Add
  - `getInfo` static function for `Liquidity` (simulate way)
- Change
  - Update dependencies

### 1.0.1-beta.0 (2021-11-19)

- Add
  - `isRaw` param for `TokenAmount`
- Change
  - Directory tree
  - Exported program ids as `PublicKey`
  - Update dependencies
