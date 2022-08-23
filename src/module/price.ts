import { BigNumberish, Rounding, tenExponential } from "../common/bignumber";
import { createLogger } from "../common/logger";

import { Currency } from "./currency";
import { Fraction } from "./fraction";

const logger = createLogger("Raydium_price");

interface PriceProps {
  baseCurrency: Currency;
  denominator: BigNumberish;
  quoteCurrency: Currency;
  numerator: BigNumberish;
}

export class Price extends Fraction {
  public readonly baseCurrency: Currency; // input i.e. denominator
  public readonly quoteCurrency: Currency; // output i.e. numerator
  // used to adjust the raw fraction w/r/t the decimals of the {base,quote}Token
  public readonly scalar: Fraction;

  // denominator and numerator _must_ be raw, i.e. in the native representation
  public constructor(params: PriceProps) {
    const { baseCurrency, quoteCurrency, numerator, denominator } = params;
    super(numerator, denominator);

    this.baseCurrency = baseCurrency;
    this.quoteCurrency = quoteCurrency;
    this.scalar = new Fraction(tenExponential(baseCurrency.decimals), tenExponential(quoteCurrency.decimals));
  }

  public get raw(): Fraction {
    return new Fraction(this.numerator, this.denominator);
  }

  public get adjusted(): Fraction {
    return super.mul(this.scalar);
  }

  public invert(): Price {
    return new Price({
      baseCurrency: this.quoteCurrency,
      quoteCurrency: this.baseCurrency,
      denominator: this.numerator,
      numerator: this.denominator,
    });
  }

  public mul(other: Price): Price {
    if (this.quoteCurrency !== other.baseCurrency) logger.logWithError("mul currency not equals");

    const fraction = super.mul(other);
    return new Price({
      baseCurrency: this.baseCurrency,
      quoteCurrency: other.quoteCurrency,
      denominator: fraction.denominator,
      numerator: fraction.numerator,
    });
  }

  public toSignificant(significantDigits = this.quoteCurrency.decimals, format?: object, rounding?: Rounding): string {
    return this.adjusted.toSignificant(significantDigits, format, rounding);
  }

  public toFixed(decimalPlaces = this.quoteCurrency.decimals, format?: object, rounding?: Rounding): string {
    return this.adjusted.toFixed(decimalPlaces, format, rounding);
  }
}
