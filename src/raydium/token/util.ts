import { ApiTokenInfo } from "../../api/type";

import { TokenJson } from "./type";

export function sortTokens(tokens: TokenJson[], mintList: { official: string[]; unOfficial: string[] }): TokenJson[] {
  return tokens.sort((tokenA, tokenB) => {
    const { official, unOfficial } = mintList;
    const officialMintSet = new Set(official);
    const unOfficialMintSet = new Set(unOfficial);

    const getPriority = (token: ApiTokenInfo): number =>
      officialMintSet.has(token.mint) ? 1 : unOfficialMintSet.has(token.mint) ? 2 : 3;
    const priorityOrderDiff = getPriority(tokenA) - getPriority(tokenB);
    const startWithLetter = (s: string): boolean => !/^[a-zA-Z]/.test(s);
    if (priorityOrderDiff === 0) {
      const startWithLetterA = startWithLetter(tokenA.symbol);
      const startWithLetterB = startWithLetter(tokenB.symbol);
      if (startWithLetterA && !startWithLetterB) return 1;
      if (!startWithLetterA && startWithLetterB) return -1;
      return tokenA.symbol.localeCompare(tokenB.symbol);
    } else {
      return priorityOrderDiff;
    }
  });
}
