import { Currency, CurrencyAmount } from "../../src/entity";

describe("Test CurrencyAmount", () => {
  const sol = Currency.SOL;

  it("should works when pass raw lamports", () => {
    expect(new CurrencyAmount(sol, 1, true).toFixed()).toBe("0.000000001");
  });

  it("should works when pass UI amount", () => {
    expect(new CurrencyAmount(sol, 1, false).toFixed()).toBe("1.000000000");
    expect(new CurrencyAmount(sol, "1", false).toFixed()).toBe("1.000000000");

    expect(new CurrencyAmount(sol, 1.1, false).toFixed()).toBe("1.100000000");
    expect(new CurrencyAmount(sol, "1.1", false).toFixed()).toBe("1.100000000");

    expect(new CurrencyAmount(sol, 1.37786, false).toFixed()).toBe("1.377860000");
    expect(new CurrencyAmount(sol, "1.37786", false).toFixed()).toBe("1.377860000");

    expect(new CurrencyAmount(sol, 1.377865961, false).toFixed()).toBe("1.377865961");
    expect(new CurrencyAmount(sol, "1.377865961", false).toFixed()).toBe("1.377865961");
  });
});
