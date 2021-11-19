import { GetStructureSchema, publicKey, struct, u128, u64 } from "../marshmallow";

/* ================= state layouts ================= */
export const LIQUIDITY_STATE_LAYOUT_V4 = struct([
  u64("status"),
  u64("nonce"),
  u64("maxOrder"),
  u64("depth"),
  u64("baseDecimal"),
  u64("quoteDecimal"),
  u64("state"),
  u64("resetFlag"),
  u64("minSize"),
  u64("volMaxCutRatio"),
  u64("amountWaveRatio"),
  u64("baseLotSize"),
  u64("quoteLotSize"),
  u64("minPriceMultiplier"),
  u64("maxPriceMultiplier"),
  u64("systemDecimalValue"),
  u64("minSeparateNumerator"),
  u64("minSeparateDenominator"),
  u64("tradeFeeNumerator"),
  u64("tradeFeeDenominator"),
  u64("pnlNumerator"),
  u64("pnlDenominator"),
  u64("swapFeeNumerator"),
  u64("swapFeeDenominator"),
  u64("baseNeedTakePnl"),
  u64("quoteNeedTakePnl"),
  u64("quoteTotalPnl"),
  u64("baseTotalPnl"),
  u128("quoteTotalDeposited"),
  u128("baseTotalDeposited"),
  u128("swapBaseInAmount"),
  u128("swapQuoteOutAmount"),
  u64("swapBase2QuoteFee"),
  u128("swapQuoteInAmount"),
  u128("swapBaseOutAmount"),
  u64("swapQuote2BaseFee"),
  // amm vault
  publicKey("baseVault"),
  publicKey("quoteVault"),
  // mint
  publicKey("baseMint"),
  publicKey("quoteMint"),
  publicKey("lpMint"),
  // market
  publicKey("openOrders"),
  publicKey("marketId"),
  publicKey("marketProgramId"),
  publicKey("targetOrders"),
  publicKey("withdrawQueue"),
  publicKey("tempLpVault"),
  publicKey("owner"),
  publicKey("pnlOwner"),
]);

export type LiquidityStateLayoutV4 = GetStructureSchema<typeof LIQUIDITY_STATE_LAYOUT_V4>;

export type LiquidityStateLayout = LiquidityStateLayoutV4;

/* ================= index ================= */
// version => liquidity state layout
export const LIQUIDITY_VERSION_TO_STATE_LAYOUT: {
  [key: number]: typeof LIQUIDITY_STATE_LAYOUT_V4;
} = {
  4: LIQUIDITY_STATE_LAYOUT_V4,
};
