import BN from "bn.js";

import { Fraction } from "../module";

import { createLogger } from "./logger";

const logger = createLogger("Raydium_bignumber");

export enum Rounding {
  ROUND_DOWN,
  ROUND_HALF_UP,
  ROUND_UP,
}

export const BN_ZERO = new BN(0);
export const BN_ONE = new BN(1);
export const BN_TWO = new BN(2);
export const BN_THREE = new BN(3);
export const BN_FIVE = new BN(5);
export const BN_TEN = new BN(10);
export const BN_100 = new BN(100);
export const BN_1000 = new BN(1000);
export const BN_10000 = new BN(10000);
export type BigNumberish = BN | string | number | bigint;
export type Numberish = number | string | bigint | Fraction | BN;

const MAX_SAFE = 0x1fffffffffffff;

export function parseBigNumberish(value: BigNumberish): BN {
  // BN
  if (value instanceof BN) {
    return value;
  }

  if (typeof value === "string") {
    if (value.match(/^-?[0-9]+$/)) {
      return new BN(value);
    }
    logger.logWithError(`invalid BigNumberish string: ${value}`);
  }

  if (typeof value === "number") {
    if (value % 1) {
      logger.logWithError(`BigNumberish number underflow: ${value}`);
    }

    if (value >= MAX_SAFE || value <= -MAX_SAFE) {
      logger.logWithError(`BigNumberish number overflow: ${value}`);
    }

    return new BN(String(value));
  }

  if (typeof value === "bigint") {
    return new BN(value.toString());
  }
  logger.logWithError(`invalid BigNumberish value: ${value}`);
  return new BN(0); // never reach, because logWithError will throw error
}

export function tenExponential(shift: BigNumberish): BN {
  return BN_TEN.pow(parseBigNumberish(shift));
}

/**
 *
 * @example
 * getIntInfo(0.34) //=> { numerator: '34', denominator: '100'}
 * getIntInfo('0.34') //=> { numerator: '34', denominator: '100'}
 */
export function parseNumberInfo(n: Numberish | undefined): {
  denominator: string;
  numerator: string;
  sign?: string;
  int?: string;
  dec?: string;
} {
  if (n === undefined) return { denominator: "1", numerator: "0" };
  if (n instanceof BN) {
    return { numerator: n.toString(), denominator: "1" };
  }

  if (n instanceof Fraction) {
    return { denominator: n.denominator.toString(), numerator: n.numerator.toString() };
  }

  const s = String(n);
  const [, sign = "", int = "", dec = ""] = s.replace(",", "").match(/(-?)(\d*)\.?(\d*)/) ?? [];
  const denominator = "1" + "0".repeat(dec.length);
  const numerator = sign + (int === "0" ? "" : int) + dec || "0";
  return { denominator, numerator, sign, int, dec };
}

// round up
export function divCeil(a: BN, b: BN): BN {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const dm = a.divmod(b);

  // Fast case - exact division
  if (dm.mod.isZero()) return dm.div;

  // Round up
  return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
}
