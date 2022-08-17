import { TOKEN_SOL } from "../raydium/token/constant";

import { Token } from "./token";

interface CurrencyProps {
  decimals: number;
  symbol?: string;
  name?: string;
}
/**
 * A currency is any fungible financial instrument on Solana, including SOL and all SPL tokens.
 * The only instance of the base class `Currency` is SOL.
 */
export class Currency {
  public readonly symbol?: string;
  public readonly name?: string;
  public readonly decimals: number;

  /**
   * The only instance of the base class `Currency`.
   */
  public static readonly SOL: Currency = new Currency(TOKEN_SOL);

  /**
   * Constructs an instance of the base class `Currency`. The only instance of the base class `Currency` is `Currency.SOL`.
   * @param decimals - decimals of the currency
   * @param symbol - symbol of the currency
   * @param name - name of the currency
   */
  public constructor({ decimals, symbol = "UNKNOWN", name = "UNKNOWN" }: CurrencyProps) {
    this.decimals = decimals;
    this.symbol = symbol;
    this.name = name;
  }

  public equals(other: Currency): boolean {
    return this === other;
  }
}

/**
 * Compares two currencies for equality
 */
export function currencyEquals(currencyA: Currency, currencyB: Currency): boolean {
  if (currencyA instanceof Token && currencyB instanceof Token) {
    return currencyA.equals(currencyB);
  } else if (currencyA instanceof Token || currencyB instanceof Token) {
    return false;
  } else {
    return currencyA === currencyB;
  }
}
