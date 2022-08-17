import { CurrencyAmount, Token, TokenAmount } from "../../module";

import { LiquidityPoolStatus } from "./constant";
import { AmountSide, LiquidityPoolInfo, LiquidityPoolKeys } from "./type";

/**
 * Get currency amount side of liquidity pool
 * @param amount - the currency amount provided
 * @param poolKeys - the pool keys
 * @returns currency amount side is `base` or `quote`
 */
export function getAmountSide(amount: CurrencyAmount | TokenAmount, poolKeys: LiquidityPoolKeys): AmountSide {
  const token = amount instanceof TokenAmount ? amount.token : Token.WSOL;
  const { baseMint, quoteMint } = poolKeys;

  if (token.mint.equals(baseMint)) return "base";
  else if (token.mint.equals(quoteMint)) return "quote";
  const error = `liquidity getTokenSide - token not match with pool, params: ${JSON.stringify({
    token: token.mint,
    baseMint,
    quoteMint,
  })}`;
  console.error(error);
  throw new Error(error);
}

export function includesToken(token: Token, poolKeys: LiquidityPoolKeys): boolean {
  const { baseMint, quoteMint } = poolKeys;
  return token.mint.equals(baseMint) || token.mint.equals(quoteMint);
}

export function getPoolEnabledFeatures(poolInfo: LiquidityPoolInfo): {
  swap: boolean;
  addLiquidity: boolean;
  removeLiquidity: boolean;
} {
  const { status, startTime } = poolInfo;
  const statusEnum = status.toNumber();

  const statusMap = {
    [LiquidityPoolStatus.Uninitialized]: {
      swap: false,
      addLiquidity: false,
      removeLiquidity: false,
    },
    [LiquidityPoolStatus.Initialized]: {
      swap: true,
      addLiquidity: true,
      removeLiquidity: true,
    },
    [LiquidityPoolStatus.Disabled]: {
      swap: false,
      addLiquidity: false,
      removeLiquidity: false,
    },
    [LiquidityPoolStatus.RemoveLiquidityOnly]: {
      swap: false,
      addLiquidity: false,
      removeLiquidity: true,
    },
    [LiquidityPoolStatus.LiquidityOnly]: {
      swap: false,
      addLiquidity: true,
      removeLiquidity: true,
    },
    [LiquidityPoolStatus.OrderBook]: {
      swap: false,
      addLiquidity: true,
      removeLiquidity: true,
    },
    [LiquidityPoolStatus.Swap]: {
      swap: true,
      addLiquidity: true,
      removeLiquidity: true,
    },
    [LiquidityPoolStatus.WaitingForStart]: {
      swap: Date.now() / 1000 >= startTime.toNumber(),
      addLiquidity: true,
      removeLiquidity: true,
    },
  };

  return (
    statusMap[statusEnum] || {
      swap: false,
      addLiquidity: false,
      removeLiquidity: false,
    }
  );
}
