import { WSOL } from "./sol";
import { LpTokens, SplTokens } from "./type";

export const DEVNET_SPL_TOKENS: SplTokens = {
  *[Symbol.iterator]() {
    yield* Object.values(this);
  },
  WSOL: { ...WSOL },
};

export const DEVNET_LP_TOKENS: LpTokens = {
  *[Symbol.iterator]() {
    yield* Object.values(this);
  },
};
