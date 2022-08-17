import { struct, u64, u8 } from "../../marshmallow";

export const fixedSwapInLayout = struct([u8("instruction"), u64("amountIn"), u64("minAmountOut")]);
export const fixedSwapOutLayout = struct([u8("instruction"), u64("maxAmountIn"), u64("amountOut")]);
