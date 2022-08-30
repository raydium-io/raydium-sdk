import { ComputeBudgetProgram } from "@solana/web3.js";
import BN from "bn.js";

import { BN_ONE, BN_ZERO, divCeil, Numberish, parseNumberInfo, toBN } from "../../common/bignumber";
import { createLogger } from "../../common/logger";
import { PublicKeyish, SOLMint, validateAndParsePublicKey, WSOLMint } from "../../common/pubKey";
import { jsonInfo2PoolKeys } from "../../common/utility";
import { Fraction, Percent, Price, Token, TokenAmount } from "../../module";
import { makeTransferInstruction } from "../account/instruction";
import ModuleBase, { ModuleBaseProps } from "../moduleBase";
import { SwapExtInfo } from "../trade/type";
import { LoadParams, MakeMultiTransaction, MakeTransaction } from "../type";

import { LIQUIDITY_FEES_DENOMINATOR, LIQUIDITY_FEES_NUMERATOR } from "./constant";
import {
  makeAddLiquidityInstruction,
  makeAMMSwapInstruction,
  makeCreatePoolInstruction,
  makeInitPoolInstruction,
  makeRemoveLiquidityInstruction,
} from "./instruction";
import { getDxByDyBaseIn, getDyByDxBaseIn, getStablePrice, StableLayout } from "./stable";
import {
  AmountSide,
  CreatePoolParam,
  InitPoolParam,
  LiquidityAddTransactionParams,
  LiquidityComputeAmountOutParams,
  LiquidityComputeAmountOutReturn,
  LiquidityComputeAnotherAmountParams,
  LiquidityFetchMultipleInfoParams,
  LiquidityPoolInfo,
  LiquidityPoolJsonInfo,
  LiquidityRemoveTransactionParams,
  LiquiditySide,
  LiquiditySwapTransactionParams,
  SDKParsedLiquidityInfo,
} from "./type";
import {
  getAmountSide,
  getAmountsSide,
  getAssociatedPoolKeys,
  includesToken,
  isValidFixedSide,
  makeSimulationPoolInfo,
} from "./util";

export default class Liquidity extends ModuleBase {
  private _poolInfos: LiquidityPoolJsonInfo[] = [];
  private _poolInfoMap: Map<string, LiquidityPoolJsonInfo> = new Map();
  private _officialIds: Set<string> = new Set();
  private _unOfficialIds: Set<string> = new Set();
  private _sdkParseInfoCache: Map<string, SDKParsedLiquidityInfo[]> = new Map();
  private _stableLayout: StableLayout;
  constructor(params: ModuleBaseProps) {
    super(params);
    this._stableLayout = new StableLayout({ connection: this.scope.connection });
  }

  public async load(params?: LoadParams): Promise<void> {
    await this.scope.fetchLiquidity(params?.forceUpdate);
    if (!this.scope.apiData.liquidityPools) return;
    const { data } = this.scope.apiData.liquidityPools;
    const [official, unOfficial] = [data.official || [], data.unOfficial || []];
    this._poolInfos = [...official, ...unOfficial];
    this._officialIds = new Set(
      official.map((info) => {
        this._poolInfoMap.set(info.id, info);
        return info.id;
      }),
    );
    this._unOfficialIds = new Set(
      unOfficial.map((info) => {
        this._poolInfoMap.set(info.id, info);
        return info.id;
      }),
    );
  }

  get allPools(): LiquidityPoolJsonInfo[] {
    return this._poolInfos;
  }
  get allPoolIdSet(): { official: Set<string>; unOfficial: Set<string> } {
    return {
      official: this._officialIds,
      unOfficial: this._unOfficialIds,
    };
  }
  get allPoolMap(): Map<string, LiquidityPoolJsonInfo> {
    return this._poolInfoMap;
  }

  public async fetchMultipleInfo(params: LiquidityFetchMultipleInfoParams): Promise<LiquidityPoolInfo[]> {
    await this._stableLayout.initStableModelLayout();
    return await makeSimulationPoolInfo({ ...params, connection: this.scope.connection });
  }

  public async sdkParseJsonLiquidityInfo(
    liquidityJsonInfos: LiquidityPoolJsonInfo[],
  ): Promise<SDKParsedLiquidityInfo[]> {
    if (!liquidityJsonInfos.length) return [];

    const key = liquidityJsonInfos.map((jsonInfo) => jsonInfo.id).join("-");
    if (this._sdkParseInfoCache.has(key)) return this._sdkParseInfoCache.get(key)!;
    try {
      const info = await this.fetchMultipleInfo({ pools: liquidityJsonInfos.map(jsonInfo2PoolKeys) });
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
    const logger = createLogger("Raydium_computeAmountOut");
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

  /**
   * Compute the another currency amount of add liquidity
   *
   * @param params - {@link LiquidityComputeAnotherAmountParams}
   *
   * @returns
   * anotherCurrencyAmount - currency amount without slippage
   * @returns
   * maxAnotherCurrencyAmount - currency amount with slippage
   *
   * @example
   * ```
   * Liquidity.computeAnotherAmount({
   *   // 1%
   *   slippage: new Percent(1, 100)
   * })
   * ```
   */
  public async computePairAmount({
    poolId,
    amount,
    anotherCurrency,
    slippage,
  }: LiquidityComputeAnotherAmountParams): Promise<{ anotherAmount: TokenAmount; maxAnotherAmount: TokenAmount }> {
    const poolIdPubKey = validateAndParsePublicKey({ publicKey: poolId });
    const poolInfo = this._poolInfoMap.get(poolIdPubKey.toBase58());
    if (!poolInfo) this.logAndCreateError("pool not found", poolIdPubKey.toBase58());
    const parsedInfo = (await this.sdkParseJsonLiquidityInfo([poolInfo!]))[0];
    if (!parsedInfo) this.logAndCreateError("pool parseInfo not found", poolIdPubKey.toBase58());

    const { baseReserve, quoteReserve } = parsedInfo;
    this.logDebug("baseReserve:", baseReserve.toString(), "quoteReserve:", quoteReserve.toString());

    const currencyIn = amount.token;
    this.logDebug(
      "currencyIn:",
      currencyIn,
      "amount:",
      amount.toFixed(),
      "anotherCurrency:",
      anotherCurrency,
      "slippage:",
      `${slippage.toSignificant()}%`,
    );

    // input is fixed
    const input = getAmountSide(amount, jsonInfo2PoolKeys(poolInfo!));
    this.logDebug("input side:", input);

    // round up
    let amountRaw = BN_ZERO;
    if (!amount.isZero()) {
      amountRaw =
        input === "base"
          ? divCeil(amount.raw.mul(quoteReserve), baseReserve)
          : divCeil(amount.raw.mul(baseReserve), quoteReserve);
    }

    const _slippage = new Percent(BN_ONE).add(slippage);
    const slippageAdjustedAmount = _slippage.mul(amountRaw).quotient;

    const _anotherAmount = new TokenAmount(anotherCurrency, amountRaw);
    const _maxAnotherAmount = new TokenAmount(anotherCurrency, slippageAdjustedAmount);
    this.logDebug("anotherAmount:", _anotherAmount.toFixed(), "maxAnotherAmount:", _maxAnotherAmount.toFixed());

    return {
      anotherAmount: _anotherAmount,
      maxAnotherAmount: _maxAnotherAmount,
    };
  }

  public async swapWithAMM(params: LiquiditySwapTransactionParams): Promise<MakeMultiTransaction & SwapExtInfo> {
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
        makeAMMSwapInstruction({
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
    return txBuilder.buildMultiTx({ extInfo: { amountOut } }) as MakeMultiTransaction & SwapExtInfo;
  }

  public async createPool(params: CreatePoolParam): Promise<MakeTransaction> {
    this.checkDisabled();
    this.scope.checkOwner();
    if (params.version !== 4) this.logAndCreateError("invalid version", "poolKeys.version", params.version);
    const txBuilder = this.createTxBuilder();
    const poolKeys = await getAssociatedPoolKeys(params);

    return await txBuilder
      .addInstruction({
        instructions: [makeCreatePoolInstruction({ ...poolKeys, owner: this.scope.ownerPubKey })],
      })
      .build();
  }

  public async initPool(params: InitPoolParam): Promise<MakeTransaction> {
    if (params.version !== 4) this.logAndCreateError("invalid version", "poolKeys.version", params.version);
    const { baseAmount, quoteAmount, startTime = 0, config } = params;
    const poolKeys = await getAssociatedPoolKeys(params);
    const { baseMint, quoteMint, lpMint, baseVault, quoteVault } = poolKeys;
    const txBuilder = this.createTxBuilder();
    const { account } = this.scope;

    const bypassAssociatedCheck = !!config?.bypassAssociatedCheck;
    const baseTokenAccount = await account.getCreatedTokenAccount({
      mint: baseMint,
      associatedOnly: false,
    });
    const quoteTokenAccount = await account.getCreatedTokenAccount({
      mint: quoteMint,
      associatedOnly: false,
    });

    if (!baseTokenAccount && !quoteTokenAccount)
      this.logAndCreateError("cannot found target token accounts", "tokenAccounts", account.tokenAccounts);

    const lpTokenAccount = await account.getCreatedTokenAccount({
      mint: lpMint,
      associatedOnly: false,
    });

    const { tokenAccount: _baseTokenAccount, ...baseTokenAccountInstruction } = await account.handleTokenAccount({
      side: "in",
      amount: baseAmount.raw,
      mint: baseMint,
      tokenAccount: baseTokenAccount,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(baseTokenAccountInstruction);

    const { tokenAccount: _quoteTokenAccount, ...quoteTokenAccountInstruction } = await account.handleTokenAccount({
      side: "in",
      amount: quoteAmount.raw,
      mint: quoteMint,
      tokenAccount: quoteTokenAccount,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(quoteTokenAccountInstruction);
    const { tokenAccount: _lpTokenAccount, ...lpTokenAccountInstruction } = await account.handleTokenAccount({
      side: "out",
      amount: 0,
      mint: lpMint,
      tokenAccount: lpTokenAccount,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(lpTokenAccountInstruction);
    // initPoolLayout
    txBuilder.addInstruction({
      instructions: [
        makeTransferInstruction({
          source: _baseTokenAccount,
          destination: baseVault,
          owner: this.scope.ownerPubKey,
          amount: baseAmount.raw,
        }),
        makeTransferInstruction({
          source: _quoteTokenAccount,
          destination: quoteVault,
          owner: this.scope.ownerPubKey,
          amount: quoteAmount.raw,
        }),
        makeInitPoolInstruction({
          poolKeys,
          userKeys: { lpTokenAccount: _lpTokenAccount, payer: this.scope.ownerPubKey },
          startTime,
        }),
      ],
    });

    return await txBuilder.build();
  }

  public async addLiquidity(params: LiquidityAddTransactionParams): Promise<MakeTransaction> {
    const { poolId, amountInA, amountInB, fixedSide, config } = params;
    const _poolId = validateAndParsePublicKey({ publicKey: poolId });
    const poolInfo = this.allPools.find((pool) => pool.id === _poolId.toBase58());

    if (!poolInfo) this.logAndCreateError("pool not found", poolId);
    const poolKeysList = await this.sdkParseJsonLiquidityInfo([poolInfo!]);
    const poolKeys = poolKeysList[0];
    if (!poolKeys) this.logAndCreateError("pool parse error", poolKeys);

    this.logDebug("amountInA:", amountInA, "amountInB:", amountInB);
    if (amountInA.isZero() || amountInB.isZero())
      this.logAndCreateError("amounts must greater than zero", "amountInA & amountInB", {
        amountInA: amountInA.toFixed(),
        amountInB: amountInB.toFixed(),
      });
    const { account } = this.scope;
    const bypassAssociatedCheck = config?.bypassAssociatedCheck || false;
    const [tokenA, tokenB] = [amountInA.token, amountInB.token];

    const tokenAccountA = await account.getCreatedTokenAccount({
      mint: tokenA.mint,
      associatedOnly: false,
    });
    const tokenAccountB = await account.getCreatedTokenAccount({
      mint: tokenB.mint,
      associatedOnly: false,
    });
    if (!tokenAccountA && !tokenAccountB)
      this.logAndCreateError("cannot found target token accounts", "tokenAccounts", account.tokenAccounts);

    const lpTokenAccount = await account.getCreatedTokenAccount({
      mint: poolKeys.lpMint,
    });

    const tokens = [tokenA, tokenB];
    const _tokenAccounts = [tokenAccountA, tokenAccountB];
    const rawAmounts = [amountInA.raw, amountInB.raw];

    // handle amount a & b and direction
    const [sideA] = getAmountsSide(amountInA, amountInB, poolKeys);
    let _fixedSide: AmountSide = "base";
    if (!["quote", "base"].includes(sideA) || !isValidFixedSide(fixedSide))
      this.logAndCreateError("invalid fixedSide", "fixedSide", fixedSide);
    if (sideA === "quote") {
      tokens.reverse();
      _tokenAccounts.reverse();
      rawAmounts.reverse();
      _fixedSide = fixedSide === "a" ? "quote" : "base";
    } else if (sideA === "base") {
      _fixedSide = fixedSide === "a" ? "base" : "quote";
    }

    const [baseToken, quoteToken] = tokens;
    const [baseTokenAccount, quoteTokenAccount] = _tokenAccounts;
    const [baseAmountRaw, quoteAmountRaw] = rawAmounts;
    const txBuilder = this.createTxBuilder();

    const { tokenAccount: _baseTokenAccount, ...baseInstruction } = await account.handleTokenAccount({
      side: "in",
      amount: baseAmountRaw,
      mint: baseToken.mint,
      tokenAccount: baseTokenAccount,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(baseInstruction);
    const { tokenAccount: _quoteTokenAccount, ...quoteInstruction } = await account.handleTokenAccount({
      side: "in",
      amount: quoteAmountRaw,
      mint: quoteToken.mint,
      tokenAccount: quoteTokenAccount,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(quoteInstruction);
    const { tokenAccount: _lpTokenAccount, ...lpInstruction } = await account.handleTokenAccount({
      side: "out",
      amount: 0,
      mint: poolKeys.lpMint,
      tokenAccount: lpTokenAccount,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(lpInstruction);
    txBuilder.addInstruction({
      instructions: [
        makeAddLiquidityInstruction({
          poolKeys,
          userKeys: {
            baseTokenAccount: _baseTokenAccount,
            quoteTokenAccount: _quoteTokenAccount,
            lpTokenAccount: _lpTokenAccount,
            owner: this.scope.ownerPubKey,
          },
          baseAmountIn: baseAmountRaw,
          quoteAmountIn: quoteAmountRaw,
          fixedSide: _fixedSide,
        }),
      ],
    });
    return await txBuilder.build();
  }

  public async removeLiquidity(params: LiquidityRemoveTransactionParams): Promise<MakeTransaction> {
    const { poolId, amountIn, config } = params;
    const _poolId = validateAndParsePublicKey({ publicKey: poolId });
    const poolInfo = this.allPools.find((pool) => pool.id === _poolId.toBase58());
    if (!poolInfo) this.logAndCreateError("pool not found", poolId);
    const poolKeysList = await this.sdkParseJsonLiquidityInfo([poolInfo!]);
    const poolKeys = poolKeysList[0];
    if (!poolKeys) this.logAndCreateError("pool pass error", poolKeys);

    const { baseMint, quoteMint, lpMint } = poolKeys;
    this.logDebug("amountIn:", amountIn);
    if (amountIn.isZero()) this.logAndCreateError("amount must greater than zero", "amountIn", amountIn.toFixed());
    if (!amountIn.token.mint.equals(lpMint))
      this.logAndCreateError("amountIn's token not match lpMint", "amountIn", amountIn);

    const { account } = this.scope;
    const lpTokenAccount = await account.getCreatedTokenAccount({
      mint: lpMint,
      associatedOnly: false,
    });
    if (!lpTokenAccount) this.logAndCreateError("cannot found lpTokenAccount", "tokenAccounts", account.tokenAccounts);

    const baseTokenAccount = await account.getCreatedTokenAccount({
      mint: baseMint,
    });
    const quoteTokenAccount = await account.getCreatedTokenAccount({
      mint: quoteMint,
    });

    const txBuilder = this.createTxBuilder();
    const bypassAssociatedCheck = config?.bypassAssociatedCheck || false;

    const { tokenAccount: _baseTokenAccount, ...baseInstruction } = await account.handleTokenAccount({
      side: "out",
      amount: 0,
      mint: baseMint,
      tokenAccount: baseTokenAccount,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(baseInstruction);
    const { tokenAccount: _quoteTokenAccount, ...quoteInstruction } = await account.handleTokenAccount({
      side: "out",
      amount: 0,
      mint: quoteMint,
      tokenAccount: quoteTokenAccount,
      bypassAssociatedCheck,
    });
    txBuilder.addInstruction(quoteInstruction);

    txBuilder.addInstruction({
      instructions: [
        ComputeBudgetProgram.requestUnits({
          units: 400000,
          additionalFee: 0,
        }),
        makeRemoveLiquidityInstruction({
          poolKeys,
          userKeys: {
            lpTokenAccount: lpTokenAccount!,
            baseTokenAccount: _baseTokenAccount,
            quoteTokenAccount: _quoteTokenAccount,
            owner: this.scope.ownerPubKey,
          },
          amountIn: amountIn.raw,
        }),
      ],
    });
    return await txBuilder.build();
  }

  public lpMintToTokenAmount({ poolId, amount }: { poolId: PublicKeyish; amount: Numberish }): TokenAmount {
    const poolKey = validateAndParsePublicKey({ publicKey: poolId });
    if (!poolKey) this.logAndCreateError("pool not found");
    const poolInfo = this._poolInfoMap.get(poolKey.toBase58())!;

    const numberDetails = parseNumberInfo(amount);
    const token = new Token({ mint: poolInfo.lpMint, decimals: poolInfo.lpDecimals });
    return new TokenAmount(
      token,
      toBN(
        new Fraction(numberDetails.numerator, numberDetails.denominator).mul(new BN(10).pow(new BN(token.decimals))),
      ),
    );
  }

  public getFixedSide({ poolId, inputMint }: { poolId: PublicKeyish; inputMint: PublicKeyish }): LiquiditySide {
    const [_poolId, _inputMint] = [
      validateAndParsePublicKey({ publicKey: poolId }),
      validateAndParsePublicKey({ publicKey: inputMint }),
    ];
    const pool = this._poolInfoMap.get(_poolId.toBase58());
    if (!pool) this.logAndCreateError("pool not found", _poolId.toBase58());
    let isSideA = pool!.baseMint === _inputMint.toBase58();
    if (_inputMint.equals(WSOLMint) || _inputMint.equals(SOLMint)) isSideA = !isSideA;
    return isSideA ? "a" : "b";
  }
}
