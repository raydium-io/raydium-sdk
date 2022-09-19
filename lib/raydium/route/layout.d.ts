import { Structure } from '../../marshmallow/index.js';
import * as BN from 'bn.js';
import '@solana/web3.js';
import '../../marshmallow/buffer-layout.js';

declare const routeSwapInLayout: Structure<number | BN, "", {
    instruction: number;
    amountIn: BN;
    amountOut: BN;
}>;
declare const routeSwapOutLayout: Structure<number, "", {
    instruction: number;
}>;

export { routeSwapInLayout, routeSwapOutLayout };
