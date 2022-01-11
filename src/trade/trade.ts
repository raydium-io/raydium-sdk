import { Currency, Percent, Token } from "../entity";
import { LiquidityPoolInfo, LiquidityPoolKeys } from "../liquidity";

export interface GetBestAmountOutParams {
  input: Currency | Token;
  output: Currency | Token;
  pools: {
    poolKeys: LiquidityPoolKeys;
    poolInfo: LiquidityPoolInfo;
  }[];
  markets: {
    marketKeys: [];
    bids: [];
    asks: [];
  }[];
  features: [];
  midTokens: Token[];
  slippage: Percent;
  fixedSide: "input" | "output";
}

export class Trade {
  static getBestAmountOut({ pools }: GetBestAmountOutParams) {
    // swap directly
    // place directly
    // swap routing
  }
}
