import BN from "bn.js";

import { Logger } from "../common";
import { Rounding, TEN } from "./constant";
import { Currency, currencyEquals } from "./currency";
import { BigNumberIsh, Fraction } from "./fraction";

const logger = new Logger("Entity");

export class Price extends Fraction {
  public readonly baseCurrency: Currency; // input i.e. denominator
  public readonly quoteCurrency: Currency; // output i.e. numerator
  // used to adjust the raw fraction w/r/t the decimals of the {base,quote}Token
  public readonly scalar: Fraction;

  // denominator and numerator _must_ be raw, i.e. in the native representation
  public constructor(
    baseCurrency: Currency,
    quoteCurrency: Currency,
    denominator: BigNumberIsh,
    numerator: BigNumberIsh,
  ) {
    super(numerator, denominator);

    this.baseCurrency = baseCurrency;
    this.quoteCurrency = quoteCurrency;
    this.scalar = new Fraction(TEN.pow(new BN(baseCurrency.decimals)), TEN.pow(new BN(quoteCurrency.decimals)));
  }

  public get raw(): Fraction {
    return new Fraction(this.numerator, this.denominator);
  }

  public get adjusted(): Fraction {
    return super.mul(this.scalar);
  }

  public invert(): Price {
    return new Price(this.quoteCurrency, this.baseCurrency, this.numerator, this.denominator);
  }

  public mul(other: Price): Price {
    logger.assert(currencyEquals(this.quoteCurrency, other.baseCurrency), "mul currency not equals");

    const fraction = super.mul(other);
    return new Price(this.baseCurrency, other.quoteCurrency, fraction.denominator, fraction.numerator);
  }

  // TODO: should use this.quoteCurrency.decimals?
  public toSignificant(significantDigits = 6, format?: object, rounding?: Rounding): string {
    return this.adjusted.toSignificant(significantDigits, format, rounding);
  }

  public toFixed(decimalPlaces = 4, format?: object, rounding?: Rounding): string {
    return this.adjusted.toFixed(decimalPlaces, format, rounding);
  }
}
