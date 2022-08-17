import { struct, u64, u8 } from "../../marshmallow";

export const routeSwapInLayout = struct([u8("instruction"), u64("amountIn"), u64("amountOut")]);
export const routeSwapOutLayout = struct([u8("instruction")]);
