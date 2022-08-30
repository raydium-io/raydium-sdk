import { BigNumberish, Rounding, tenExponential } from "../common/bignumber";
import { createLogger } from "../common/logger";

import { Fraction } from "./fraction";
import { Token } from "./token";

const logger = createLogger("Raydium_price");

interface PriceProps {
  baseToken: Token;
  denominator: BigNumberish;
  quoteToken: Token;
  numerator: BigNumberish;
}

export class Price extends Fraction {
  public readonly baseToken: Token; // input i.e. denominator
  public readonly quoteToken: Token; // output i.e. numerator
  // used to adjust the raw fraction w/r/t the decimals of the {base,quote}Token
  public readonly scalar: Fraction;

  // denominator and numerator _must_ be raw, i.e. in the native representation
  public constructor(params: PriceProps) {
    const { baseToken, quoteToken, numerator, denominator } = params;
    super(numerator, denominator);

    this.baseToken = baseToken;
    this.quoteToken = quoteToken;
    this.scalar = new Fraction(tenExponential(baseToken.decimals), tenExponential(quoteToken.decimals));
  }

  public get raw(): Fraction {
    return new Fraction(this.numerator, this.denominator);
  }

  public get adjusted(): Fraction {
    return super.mul(this.scalar);
  }

  public invert(): Price {
    return new Price({
      baseToken: this.quoteToken,
      quoteToken: this.baseToken,
      denominator: this.numerator,
      numerator: this.denominator,
    });
  }

  public mul(other: Price): Price {
    if (this.quoteToken !== other.baseToken) logger.logWithError("mul token not equals");

    const fraction = super.mul(other);
    return new Price({
      baseToken: this.baseToken,
      quoteToken: other.quoteToken,
      denominator: fraction.denominator,
      numerator: fraction.numerator,
    });
  }

  public toSignificant(significantDigits = this.quoteToken.decimals, format?: object, rounding?: Rounding): string {
    return this.adjusted.toSignificant(significantDigits, format, rounding);
  }

  public toFixed(decimalPlaces = this.quoteToken.decimals, format?: object, rounding?: Rounding): string {
    return this.adjusted.toFixed(decimalPlaces, format, rounding);
  }
}
