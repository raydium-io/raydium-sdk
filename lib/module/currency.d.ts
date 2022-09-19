interface CurrencyProps {
    decimals: number;
    symbol?: string;
    name?: string;
}
/**
 * A currency is any fungible financial instrument on Solana, including SOL and all SPL tokens.
 * The only instance of the base class `Currency` is SOL.
 */
declare class Currency {
    readonly symbol?: string;
    readonly name?: string;
    readonly decimals: number;
    /**
     * The only instance of the base class `Currency`.
     */
    static readonly SOL: Currency;
    /**
     * Constructs an instance of the base class `Currency`. The only instance of the base class `Currency` is `Currency.SOL`.
     * @param decimals - decimals of the currency
     * @param symbol - symbol of the currency
     * @param name - name of the currency
     */
    constructor({ decimals, symbol, name }: CurrencyProps);
    equals(other: Currency): boolean;
}
/**
 * Compares two currencies for equality
 */
declare function currencyEquals(currencyA: Currency, currencyB: Currency): boolean;

export { Currency, currencyEquals };
