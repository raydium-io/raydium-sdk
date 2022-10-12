import { Fraction, Percent, Price, TokenAmount } from "../module";

import { BN_ZERO, Numberish, parseNumberInfo } from "./bignumber";

export default function toFraction(value: Numberish): Fraction {
  //  to complete math format(may have decimal), not int
  if (value instanceof Percent) return new Fraction(value.numerator, value.denominator);

  if (value instanceof Price) return value.adjusted;

  // to complete math format(may have decimal), not BN
  if (value instanceof TokenAmount)
    try {
      return toFraction(value.toExact());
    } catch {
      return new Fraction(BN_ZERO);
    }

  // do not ideal with other fraction value
  if (value instanceof Fraction) return value;

  // wrap to Fraction
  const n = String(value);
  const details = parseNumberInfo(n);
  return new Fraction(details.numerator, details.denominator);
}

export function toFractionWithDecimals(value: Numberish): { fr: Fraction; decimals?: number } {
  //  to complete math format(may have decimal), not int
  if (value instanceof Percent) return { fr: new Fraction(value.numerator, value.denominator) };

  if (value instanceof Price) return { fr: value.adjusted };

  // to complete math format(may have decimal), not BN
  if (value instanceof TokenAmount) return { fr: toFraction(value.toExact()), decimals: value.token.decimals };

  // do not ideal with other fraction value
  if (value instanceof Fraction) return { fr: value };

  // wrap to Fraction
  const n = String(value);
  const details = parseNumberInfo(n);
  return { fr: new Fraction(details.numerator, details.denominator), decimals: details.dec?.length };
}

export function lt(a: Numberish | undefined, b: Numberish | undefined): boolean {
  if (a == null || b == null) return false;
  const fa = toFraction(a);
  const fb = toFraction(b);
  fa.sub(fb).numerator;
  return fa.sub(fb).numerator.lt(BN_ZERO);
}

export function gt(a: Numberish | undefined, b: Numberish | undefined): boolean {
  if (a == null || b == null) return false;
  const fa = toFraction(a);
  const fb = toFraction(b);
  return fa.sub(fb).numerator.gt(BN_ZERO);
}

export function lte(a: Numberish | undefined, b: Numberish | undefined): boolean {
  if (a == null || b == null) return false;
  const fa = toFraction(a);
  const fb = toFraction(b);
  return fa.sub(fb).numerator.lte(BN_ZERO);
}

export function gte(a: Numberish | undefined, b: Numberish | undefined): boolean {
  if (a == null || b == null) return false;
  const fa = toFraction(a);
  const fb = toFraction(b);
  return fa.sub(fb).numerator.gte(BN_ZERO);
}

export function eq(a: Numberish | undefined, b: Numberish | undefined): boolean {
  if (a == null || b == null) return false;
  const fa = toFraction(a);
  const fb = toFraction(b);
  return fa.sub(fb).numerator.eq(BN_ZERO);
}

export function div(a: Numberish | undefined, b: Numberish | undefined): Fraction | undefined {
  if (a == null || b == null) return undefined;
  const fa = toFraction(a);
  const fb = toFraction(b);
  try {
    return fa.div(fb); // if fb is zero , operation will throw error
  } catch {
    return fa;
  }
}

export function sub(a: Numberish | undefined, b: Numberish | undefined): Fraction | undefined {
  if (a == null || b == null) return undefined;
  const fa = toFraction(a);
  const fb = toFraction(b);
  return fa.sub(fb);
}

export function isMeaningfulNumber(n: Numberish | undefined): n is Numberish {
  if (n == null) return false;
  return !eq(n, 0);
}

export function getMax(a: Numberish, b: Numberish): Numberish {
  return gt(b, a) ? b : a;
}

export function mul(a: Numberish | undefined, b: Numberish | undefined): Fraction | undefined {
  if (a == null || b == null) return undefined;
  const fa = toFraction(a);
  const fb = toFraction(b);
  return fa.mul(fb);
}

export function add(a: Numberish | undefined, b: Numberish | undefined): Fraction | undefined {
  if (a == null || b == null) return undefined;
  const fa = toFraction(a);
  const fb = toFraction(b);
  return fa.add(fb);
}
