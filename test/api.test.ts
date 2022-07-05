import { Api } from "../src/api";

describe("Test Api", () => {
  const api = new Api();

  it("should works when get tokens", async () => {
    const tokens = await api.getTokens();
    console.log(tokens);
    // expect(new CurrencyAmount(sol, 1, true).toFixed()).toBe("0.000000001");
  });
});
