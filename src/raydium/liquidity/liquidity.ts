import BN from "bn.js";

import { ApiLiquidityPoolInfo } from "../../api";
import { BN_ONE, BN_ZERO } from "../../common/bignumber";
import { createLogger } from "../../common/logger";
import { parseSimulateLogToJson, parseSimulateValue, simulateMultipleInstruction } from "../../common/txTool";
import { jsonInfo2PoolKeys } from "../../common/utility";
import { Percent, Price, TokenAmount } from "../../module";
import ModuleBase, { ModuleBaseProps } from "../moduleBase";
import { MakeTransaction } from "../type";

import { LIQUIDITY_FEES_DENOMINATOR, LIQUIDITY_FEES_NUMERATOR } from "./constant";
import { makeSimulatePoolInfoInstruction, makeSwapInstruction } from "./instruction";
import { getDxByDyBaseIn, getDyByDxBaseIn, getStablePrice, StableLayout } from "./stable";
import {
  LiquidityComputeAmountOutParams,
  LiquidityComputeAmountOutReturn,
  LiquidityFetchMultipleInfoParams,
  LiquidityPoolInfo,
  LiquiditySwapTransactionParams,
  SDKParsedLiquidityInfo,
} from "./type";
import { getAmountSide, includesToken } from "./util";

export default class Liquidity extends ModuleBase {
  private _poolInfos: ApiLiquidityPoolInfo[] = [];
  private _officialIds: Set<string> = new Set();
  private _unOfficialIds: Set<string> = new Set();
  private _sdkParseInfoCache: Map<string, SDKParsedLiquidityInfo[]> = new Map();
  private _stableLayout: StableLayout;
  constructor(params: ModuleBaseProps) {
    super(params);
    this._stableLayout = new StableLayout({ connection: this.scope.connection });
  }

  public async load(): Promise<void> {
    await this.scope.fetchLiquidity();
    if (!this.scope.apiData.liquidityPools) return;
    const { data } = this.scope.apiData.liquidityPools;
    const [official, unOfficial] = [data.official || [], data.unOfficial || []];
    this._poolInfos = [...official, ...unOfficial];
    this._officialIds = new Set(official.map((i) => i.id));
    this._unOfficialIds = new Set(unOfficial.map((i) => i.id));
  }

  get allPools(): ApiLiquidityPoolInfo[] {
    return this._poolInfos;
  }
  get allPoolIdSet(): { official: Set<string>; unOfficial: Set<string> } {
    return {
      official: this._officialIds,
      unOfficial: this._unOfficialIds,
    };
  }

  public async fetchMultipleLiquidityInfo({ pools }: LiquidityFetchMultipleInfoParams): Promise<LiquidityPoolInfo[]> {
    await this._stableLayout.initStableModelLayout();

    const instructions = pools.map((pool) => makeSimulatePoolInfoInstruction(pool));
    const logs = await simulateMultipleInstruction(this.scope.connection, instructions, "GetPoolData");

    const poolsInfo = logs.map((log) => {
      const json = parseSimulateLogToJson(log, "GetPoolData");
      const status = new BN(parseSimulateValue(json, "status"));
      const baseDecimals = Number(parseSimulateValue(json, "coin_decimals"));
      const quoteDecimals = Number(parseSimulateValue(json, "pc_decimals"));
      const lpDecimals = Number(parseSimulateValue(json, "lp_decimals"));
      const baseReserve = new BN(parseSimulateValue(json, "pool_coin_amount"));
      const quoteReserve = new BN(parseSimulateValue(json, "pool_pc_amount"));
      const lpSupply = new BN(parseSimulateValue(json, "pool_lp_supply"));
      let startTime = "0";
      try {
        startTime = parseSimulateValue(json, "pool_open_time");
      } catch (error) {
        startTime = "0";
      }

      return {
        status,
        baseDecimals,
        quoteDecimals,
        lpDecimals,
        baseReserve,
        quoteReserve,
        lpSupply,
        startTime: new BN(startTime),
      };
    });

    return poolsInfo;
  }

  public async sdkParseJsonLiquidityInfo(
    liquidityJsonInfos: ApiLiquidityPoolInfo[],
  ): Promise<SDKParsedLiquidityInfo[]> {
    if (!liquidityJsonInfos.length) return [];

    const key = liquidityJsonInfos.map((jsonInfo) => jsonInfo.id).join("-");
    if (this._sdkParseInfoCache.has(key)) return this._sdkParseInfoCache.get(key)!;
    try {
      const info = await this.fetchMultipleLiquidityInfo({ pools: liquidityJsonInfos.map(jsonInfo2PoolKeys) });
      const result = info.map((sdkParsed, idx) => ({
        jsonInfo: liquidityJsonInfos[idx],
        ...jsonInfo2PoolKeys(liquidityJsonInfos[idx]),
        ...sdkParsed,
      }));
      this._sdkParseInfoCache.set(key, result);
      return result;
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  public computeAmountOut({
    poolKeys,
    poolInfo,
    amountIn,
    outputToken,
    slippage,
  }: LiquidityComputeAmountOutParams): LiquidityComputeAmountOutReturn {
    this.checkDisabled();
    const logger = createLogger("Liquidity computeAmountOut");
    const tokenIn = amountIn.token;
    const tokenOut = outputToken;
    if (!includesToken(tokenIn, poolKeys) || !includesToken(tokenOut, poolKeys))
      logger.logWithError("token not match with pool", "poolKeys", poolKeys);

    const { baseReserve, quoteReserve } = poolInfo;
    this.logDebug("baseReserve:", baseReserve.toString(), "quoteReserve:", quoteReserve.toString());
    const inputToken = amountIn.token;
    this.logDebug("inputToken:", inputToken);
    this.logDebug("amountIn:", amountIn.toFixed());
    this.logDebug("outputToken:", outputToken);
    this.logDebug("slippage:", `${slippage.toSignificant()}%`);

    const reserves = [baseReserve, quoteReserve];
    const input = getAmountSide(amountIn, poolKeys);
    if (input === "quote") reserves.reverse();
    this.logDebug("input side:", input);

    const [reserveIn, reserveOut] = reserves;
    let currentPrice;
    if (poolKeys.version === 4) {
      currentPrice = new Price({
        baseCurrency: inputToken,
        denominator: reserveIn,
        quoteCurrency: outputToken,
        numerator: reserveOut,
      });
    } else {
      const p = getStablePrice(
        this._stableLayout.stableModelData,
        baseReserve.toNumber(),
        quoteReserve.toNumber(),
        false,
      );
      currentPrice = new Price({
        baseCurrency: inputToken,
        denominator: input === "quote" ? new BN(p * 1e6) : new BN(1e6),
        quoteCurrency: outputToken,
        numerator: input === "quote" ? new BN(1e6) : new BN(p * 1e6),
      });
    }
    this.logDebug("currentPrice:", `1 ${inputToken.symbol} ≈ ${currentPrice.toFixed()} ${outputToken.symbol}`);
    this.logDebug(
      "currentPrice invert:",
      `1 ${outputToken.symbol} ≈ ${currentPrice.invert().toFixed()} ${inputToken.symbol}`,
    );

    const amountInRaw = amountIn.raw;
    let amountOutRaw = BN_ZERO;
    let feeRaw = BN_ZERO;

    if (!amountInRaw.isZero()) {
      if (poolKeys.version === 4) {
        feeRaw = amountInRaw.mul(LIQUIDITY_FEES_NUMERATOR).div(LIQUIDITY_FEES_DENOMINATOR);
        const amountInWithFee = amountInRaw.sub(feeRaw);
        const denominator = reserveIn.add(amountInWithFee);
        amountOutRaw = reserveOut.mul(amountInWithFee).div(denominator);
      } else {
        feeRaw = amountInRaw.mul(new BN(2)).div(new BN(10000));
        const amountInWithFee = amountInRaw.sub(feeRaw);
        const convertFn = input === "quote" ? getDyByDxBaseIn : getDxByDyBaseIn;
        amountOutRaw = new BN(
          convertFn(
            this._stableLayout.stableModelData,
            quoteReserve.toNumber(),
            baseReserve.toNumber(),
            amountInWithFee.toNumber(),
          ),
        );
      }
    }

    const _slippage = new Percent(BN_ONE).add(slippage);
    const minAmountOutRaw = _slippage.invert().mul(amountOutRaw).quotient;
    const amountOut = new TokenAmount(outputToken, amountOutRaw);
    const minAmountOut = new TokenAmount(outputToken, minAmountOutRaw);
    this.logDebug("amountOut:", amountOut.toFixed(), "minAmountOut:", minAmountOut.toFixed());

    let executionPrice = new Price({
      baseCurrency: inputToken,
      denominator: amountInRaw.sub(feeRaw),
      quoteCurrency: outputToken,
      numerator: amountOutRaw,
    });
    if (!amountInRaw.isZero() && !amountOutRaw.isZero()) {
      executionPrice = new Price({
        baseCurrency: inputToken,
        denominator: amountInRaw.sub(feeRaw),
        quoteCurrency: outputToken,
        numerator: amountOutRaw,
      });
      this.logDebug("executionPrice:", `1 ${inputToken.symbol} ≈ ${executionPrice.toFixed()} ${outputToken.symbol}`);
      this.logDebug(
        "executionPrice invert:",
        `1 ${outputToken.symbol} ≈ ${executionPrice.invert().toFixed()} ${inputToken.symbol}`,
      );
    }

    const priceImpact = new Percent(
      parseInt(String(Math.abs(parseFloat(executionPrice.toFixed()) - parseFloat(currentPrice.toFixed())) * 1e9)),
      parseInt(String(parseFloat(currentPrice.toFixed()) * 1e9)),
    );
    const fee = new TokenAmount(inputToken, feeRaw);

    return {
      amountOut,
      minAmountOut,
      currentPrice,
      executionPrice,
      priceImpact,
      fee,
    };
  }

  public async swapWithAMM(params: LiquiditySwapTransactionParams): Promise<MakeTransaction> {
    const { poolKeys, payer, amountIn, amountOut, fixedSide, config } = params;
    this.logDebug("amountIn:", amountIn);
    this.logDebug("amountOut:", amountOut);
    if (amountIn.isZero() || amountOut.isZero())
      this.logAndCreateError("amounts must greater than zero", "currencyAmounts", {
        amountIn: amountIn.toFixed(),
        amountOut: amountOut.toFixed(),
      });
    const { account } = this.scope;
    const txBuilder = this.createTxBuilder();
    const { bypassAssociatedCheck = false } = config || {};

    const [tokenIn, tokenOut] = [amountIn.token, amountOut.token];
    const tokenAccountIn = await account.getCreatedTokenAccount({
      mint: tokenIn.mint,
      associatedOnly: false,
    });
    const tokenAccountOut = await account.getCreatedTokenAccount({
      mint: tokenOut.mint,
    });

    const [amountInRaw, amountOutRaw] = [amountIn.raw, amountOut.raw];

    const { tokenAccount: _tokenAccountIn, ...inTxInstructions } = await account.handleTokenAccount({
      side: "in",
      amount: amountInRaw,
      mint: tokenIn.mint,
      tokenAccount: tokenAccountIn,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(inTxInstructions);

    const { tokenAccount: _tokenAccountOut, ...outTxInstructions } = await account.handleTokenAccount({
      side: "out",
      amount: 0,
      mint: tokenOut.mint,
      tokenAccount: tokenAccountOut,
      payer,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(outTxInstructions);
    txBuilder.addInstruction({
      instructions: [
        makeSwapInstruction({
          poolKeys,
          userKeys: {
            tokenAccountIn: _tokenAccountIn,
            tokenAccountOut: _tokenAccountOut,
            owner: this.scope.ownerPubKey,
          },
          amountIn: amountInRaw,
          amountOut: amountOutRaw,
          fixedSide,
        }),
      ],
    });
    return await txBuilder.build();
  }
}
