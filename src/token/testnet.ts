import { WSOL } from "./sol";
import { LpTokens, SplTokens } from "./type";

export const TESTNET_SPL_TOKENS: SplTokens = {
  *[Symbol.iterator]() {
    yield* Object.values(this);
  },
  WSOL: { ...WSOL },
};

export const TESTNET_LP_TOKENS: LpTokens = {
  *[Symbol.iterator]() {
    yield* Object.values(this);
  },
};
