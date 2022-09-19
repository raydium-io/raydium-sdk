import { N as Numberish, F as Fraction } from '../bignumber-cbebe552.js';
import 'bn.js';
import '../module/token.js';
import '@solana/web3.js';
import './pubKey.js';
import '../raydium/token/type.js';
import './logger.js';
import 'pino';

declare function toFraction(value: Numberish): Fraction;
declare function toFractionWithDecimals(value: Numberish): {
    fr: Fraction;
    decimals?: number;
};
declare function lt(a: Numberish | undefined, b: Numberish | undefined): boolean;
declare function gt(a: Numberish | undefined, b: Numberish | undefined): boolean;
declare function lte(a: Numberish | undefined, b: Numberish | undefined): boolean;
declare function gte(a: Numberish | undefined, b: Numberish | undefined): boolean;
declare function eq(a: Numberish | undefined, b: Numberish | undefined): boolean;
declare function div(a: Numberish | undefined, b: Numberish | undefined): Fraction | undefined;
declare function sub(a: Numberish | undefined, b: Numberish | undefined): Fraction | undefined;
declare function isMeaningfulNumber(n: Numberish | undefined): n is Numberish;
declare function getMax(a: Numberish, b: Numberish): Numberish;

export { toFraction as default, div, eq, getMax, gt, gte, isMeaningfulNumber, lt, lte, sub, toFractionWithDecimals };
