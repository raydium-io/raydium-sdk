import BN from "bn.js";

export const ZERO = new BN(0);
export const ONE = new BN(1);
export const NEGATIVE_ONE = new BN(-1);

export const Q64 = new BN(1).shln(64);
export const Q128 = new BN(1).shln(128);

export const MaxU64 = Q64.sub(ONE);

export const U64Resolution = 64;

export const MaxUint128 = Q128.subn(1);

export const MIN_TICK = -307200;
export const MAX_TICK = -MIN_TICK;

export const MIN_SQRT_PRICE_X64: BN = new BN("3939943522091");
export const MAX_SQRT_PRICE_X64: BN = new BN("86367321006760116002434269");

export const MIN_TICK_ARRAY_START_INDEX = -307200;
export const MAX_TICK_ARRAY_START_INDEX = 306600;

export const BIT_PRECISION = 14;
export const LOG_B_2_X32 = "59543866431248";
export const LOG_B_P_ERR_MARGIN_LOWER_X64 = "184467440737095516";
export const LOG_B_P_ERR_MARGIN_UPPER_X64 = "15793534762490258745";

export const FEE_RATE_DENOMINATOR = new BN(10).pow(new BN(6));

export enum Fee {
  rate_500 = 500, //  500 / 10e6 = 0.0005
  rate_3000 = 3000, // 3000/ 10e6 = 0.003
  rate_10000 = 10000, // 10000 /10e6 = 0.01
}
export const TICK_SPACINGS: { [amount in Fee]: number } = {
  [Fee.rate_500]: 10,
  [Fee.rate_3000]: 60,
  [Fee.rate_10000]: 200,
};
