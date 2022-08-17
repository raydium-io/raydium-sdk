import BN from "bn.js";

export enum LiquidityPoolStatus {
  Uninitialized,
  Initialized,
  Disabled,
  RemoveLiquidityOnly,
  LiquidityOnly,
  OrderBook,
  Swap,
  WaitingForStart,
}

export const LIQUIDITY_FEES_NUMERATOR = new BN(25);
export const LIQUIDITY_FEES_DENOMINATOR = new BN(10000);
