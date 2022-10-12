import BN from "bn.js";
import Decimal from "decimal.js";
import { PublicKey } from "@solana/web3.js";
import { Token } from "../module/token";
import { Price } from "../module/price";
import { Currency } from "../module/currency";
import { TokenAmount, CurrencyAmount } from "../module/amount";
import { Fraction } from "../module/fraction";
import { Percent } from "../module/percent";
import { SplToken, TokenJson } from "../raydium/token/type";
import { ReplaceType } from "../raydium/type";
import { createLogger } from "./logger";
import { mul } from "./fractionUtil";

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
  const logger = createLogger("Raydium_parseBigNumberish");
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
  logger.error(`invalid BigNumberish value: ${value}`);
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

export function shakeFractionDecimal(n: Fraction): string {
  const [, sign = "", int = ""] = n.toFixed(2).match(/(-?)(\d*)\.?(\d*)/) ?? [];
  return `${sign}${int}`;
}

export function toBN(n: Numberish, decimal: BigNumberish = 0): BN {
  if (n instanceof BN) return n;
  return new BN(shakeFractionDecimal(toFraction(n).mul(BN_TEN.pow(new BN(String(decimal))))));
}

export function toFraction(value: Numberish): Fraction {
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

/**
 * @example
 * toPercent(3.14) // => Percent { 314.00% }
 * toPercent(3.14, { alreadyDecimaled: true }) // => Percent {3.14%}
 */
export function toPercent(
  n: Numberish,
  options?: { /* usually used for backend data */ alreadyDecimaled?: boolean },
): Percent {
  const { numerator, denominator } = parseNumberInfo(n);
  return new Percent(new BN(numerator), new BN(denominator).mul(options?.alreadyDecimaled ? new BN(100) : new BN(1)));
}

export function toTokenPrice(params: {
  token: TokenJson | Token | SplToken;
  numberPrice: Numberish;
  decimalDone?: boolean;
}): Price {
  const { token, numberPrice, decimalDone } = params;
  const usdCurrency = new Token({ mint: "", decimals: 6, symbol: "usd", name: "usd", skipMint: true });
  const { numerator, denominator } = parseNumberInfo(numberPrice);
  const parsedNumerator = decimalDone ? new BN(numerator).mul(BN_TEN.pow(new BN(token.decimals))) : numerator;
  const parsedDenominator = new BN(denominator).mul(BN_TEN.pow(new BN(usdCurrency.decimals)));

  return new Price({
    baseToken: usdCurrency,
    denominator: parsedDenominator.toString(),
    quoteToken: new Token({ ...token, skipMint: true, mint: "" }),
    numerator: parsedNumerator.toString(),
  });
}

export function toUsdCurrency(amount: Numberish): CurrencyAmount {
  const usdCurrency = new Currency({ decimals: 6, symbol: "usd", name: "usd" });
  const amountBigNumber = toBN(mul(amount, 10 ** usdCurrency.decimals)!);
  return new CurrencyAmount(usdCurrency, amountBigNumber);
}

export function toTotalPrice(amount: Numberish | undefined, price: Price | undefined): CurrencyAmount {
  if (!price || !amount) return toUsdCurrency(0);
  return toUsdCurrency(mul(amount, price)!);
}

export function decimalToFraction(n: Decimal | undefined): Fraction | undefined {
  if (n == null) return undefined;
  const { numerator, denominator } = parseNumberInfo(n.toString());
  return new Fraction(numerator, denominator);
}

function notInnerObject(v: unknown): boolean {
  const baseInnerObjects = [Token, TokenAmount, PublicKey, Fraction, BN, Currency, CurrencyAmount, Price, Percent];
  return typeof v === "object" && v !== null && !baseInnerObjects.some((o) => !!o && v instanceof o);
}

export function isDecimal(val: unknown): boolean {
  return val instanceof Decimal;
}

export function recursivelyDecimalToFraction<T>(info: T): ReplaceType<T, Decimal, Fraction> {
  // @ts-expect-error no need type for inner code
  return isDecimal(info)
    ? decimalToFraction(info as any)
    : Array.isArray(info)
    ? info.map((k) => recursivelyDecimalToFraction(k))
    : notInnerObject(info)
    ? Object.fromEntries(Object.entries(info as any).map(([k, v]) => [k, recursivelyDecimalToFraction(v)]))
    : info;
}
