import { MAINNET_LP_TOKENS, MAINNET_SPL_TOKENS, TokenList } from "../../src/token";

describe("Test token list", () => {
  const tokenList = new TokenList([...MAINNET_SPL_TOKENS, ...MAINNET_LP_TOKENS]);

  it("should works when filterByMint use valid mint", () => {
    const result = tokenList.filterByMint(MAINNET_SPL_TOKENS.WSOL.mint);
    expect(result.length).toEqual(1);
  });

  it("should works when filterUniqueByMint use valid mint", () => {
    const result = tokenList.filterUniqueByMint(MAINNET_SPL_TOKENS.WSOL.mint);
    expect(result.mint).toEqual(MAINNET_SPL_TOKENS.WSOL.mint);
  });

  it("should revert when filterUniqueByMint use invalid mint", () => {
    expect(() => tokenList.filterUniqueByMint("SOL")).toThrow(/No token found/);
  });

  it("should revert when filterUniqueByMint SPL use LP mint", () => {
    expect(() => tokenList.filterUniqueByMint(MAINNET_LP_TOKENS.RAY_SOL_V4.mint, "spl")).toThrow(
      /invalid SPL token mint/,
    );
  });

  it("should revert when filterUniqueByMint LP use SPL mint", () => {
    expect(() => tokenList.filterUniqueByMint(MAINNET_SPL_TOKENS.WSOL.mint, "lp")).toThrow(/invalid LP token mint/);
  });

  it("test token list length", () => {
    const result = tokenList.getList();
    expect(result.length).toEqual(Object.values(MAINNET_SPL_TOKENS).length + Object.values(MAINNET_LP_TOKENS).length);
  });
});
