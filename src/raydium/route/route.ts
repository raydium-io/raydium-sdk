import { PublicKey } from "@solana/web3.js";
import { intersection, xor } from "lodash";

import { Price } from "../../module/price";
import { Token } from "../../module/token";
import { getPoolEnabledFeatures, includesToken } from "../liquidity/util";
import ModuleBase, { ModuleBaseProps } from "../moduleBase";
import { SwapExtInfo } from "../trade/type";
import { MakeTransaction } from "../type";

import { ROUTE_PROGRAM_ID_V1 } from "./constant";
import { makeRouteSwapInstruction } from "./instruction";
import { RouteComputeAmountOutData, RouteComputeAmountOutParams, RouteSwapTransactionParams } from "./type";
import { getAssociatedMiddleStatusAccount } from "./util";

export default class Route extends ModuleBase {
  constructor(params: ModuleBaseProps) {
    super(params);
  }

  public computeRouteAmountOut({
    fromPoolKeys,
    toPoolKeys,
    fromPoolInfo,
    toPoolInfo,
    amountIn,
    outputToken,
    slippage,
  }: RouteComputeAmountOutParams): RouteComputeAmountOutData {
    const { swap: fromPoolSwapEnabled } = getPoolEnabledFeatures(fromPoolInfo);
    const { swap: toPoolSwapEnabled } = getPoolEnabledFeatures(toPoolInfo);
    if (!fromPoolSwapEnabled || !toPoolSwapEnabled)
      this.logAndCreateError("pools swap not enabled", "pools", {
        fromPoolKeys,
        toPoolKeys,
        fromPoolInfo,
        toPoolInfo,
      });

    const tokenIn = amountIn.token;
    const tokenOut = outputToken;

    if (!includesToken(tokenIn, fromPoolKeys) || !includesToken(tokenOut, toPoolKeys))
      this.logAndCreateError("pools cannot be routed", "pools", {
        fromPoolKeys,
        toPoolKeys,
      });

    const fromPoolMints = [fromPoolKeys.baseMint.toBase58(), fromPoolKeys.quoteMint.toBase58()];
    const toPoolMints = [toPoolKeys.baseMint.toBase58(), toPoolKeys.quoteMint.toBase58()];
    const mints = [...fromPoolMints, ...toPoolMints];
    const decimals = [
      fromPoolInfo.baseDecimals,
      fromPoolInfo.quoteDecimals,
      toPoolInfo.baseDecimals,
      toPoolInfo.quoteDecimals,
    ];
    const [mintIn, mintOut] = [tokenIn.mint.toBase58(), tokenOut.mint.toBase58()];

    const xorMints = xor(fromPoolMints, toPoolMints);
    if (xorMints.length !== 2 || !xorMints.includes(mintIn) || !xorMints.includes(mintOut))
      this.logAndCreateError("xor tokens not match", "pools", {
        fromPoolKeys,
        toPoolKeys,
      });

    const intersectionMints = intersection(fromPoolMints, toPoolMints);
    if (intersectionMints.length !== 1)
      this.logAndCreateError("cannot found middle token of two pools", "pools", {
        fromPoolKeys,
        toPoolKeys,
      });

    const _middleMint = intersectionMints[0];
    const index = mints.indexOf(_middleMint);
    if (index === -1)
      this.logAndCreateError("cannot found middle token", "pools", {
        fromPoolKeys,
        toPoolKeys,
      });

    const middleMintDecimals = decimals[index];
    const middleMint = new PublicKey(_middleMint);
    const middleToken = new Token({ mint: middleMint, decimals: middleMintDecimals });

    this.logInfo(`from pool:`, fromPoolKeys);
    this.logInfo("to pool:", toPoolKeys);
    this.logInfo("intersection mints:", intersectionMints);
    this.logInfo("xor mints:", xorMints);
    this.logInfo("middleMint:", _middleMint);

    const {
      minAmountOut: minMiddleAmountOut,
      priceImpact: firstPriceImpact,
      fee: firstFee,
    } = this.scope.liquidity.computeAmountOut({
      poolKeys: fromPoolKeys,
      poolInfo: fromPoolInfo,
      amountIn,
      outputToken: middleToken,
      slippage,
    });
    const {
      amountOut,
      minAmountOut,
      priceImpact: secondPriceImpact,
      fee: secondFee,
    } = this.scope.liquidity.computeAmountOut({
      poolKeys: toPoolKeys,
      poolInfo: toPoolInfo,
      amountIn: minMiddleAmountOut,
      outputToken,
      slippage,
    });

    let executionPrice: Price | null = null;
    const [amountInRaw, amountOutRaw] = [amountIn.raw, amountOut.raw];
    const currencyIn = amountIn.token;
    if (!amountInRaw.isZero() && !amountOutRaw.isZero()) {
      executionPrice = new Price({
        baseCurrency: currencyIn,
        denominator: amountInRaw,
        quoteCurrency: outputToken,
        numerator: amountOutRaw,
      });
      this.logDebug("executionPrice:", `1 ${currencyIn.symbol} ≈ ${executionPrice.toFixed()} ${outputToken.symbol}`);
      this.logDebug(
        "executionPrice invert:",
        `1 ${outputToken.symbol} ≈ ${executionPrice.invert().toFixed()} ${currencyIn.symbol}`,
      );
    }

    return {
      amountOut,
      minAmountOut,
      executionPrice,
      priceImpact: firstPriceImpact.add(secondPriceImpact),
      fee: [firstFee, secondFee],
    };
  }

  public async swapWithRoute(params: RouteSwapTransactionParams): Promise<MakeTransaction & SwapExtInfo> {
    const { fromPoolKeys, toPoolKeys, amountIn, amountOut, fixedSide, config } = params;
    this.logDebug("amountIn:", amountIn, "amountOut:", amountOut);
    if (amountIn.isZero() || amountOut.isZero())
      this.logAndCreateError("amounts must greater than zero", "currencyAmounts", {
        amountIn: amountIn.toFixed(),
        amountOut: amountOut.toFixed(),
      });
    const { account } = this.scope;
    const { bypassAssociatedCheck = false } = config || {};
    const [tokenIn, tokenOut] = [amountIn.token, amountOut.token];

    const tokenAccountIn = await this.scope.account.getCreatedTokenAccount({
      mint: tokenIn.mint,
      associatedOnly: false,
    });
    const tokenAccountOut = await this.scope.account.getCreatedTokenAccount({
      mint: tokenOut.mint,
    });

    const fromPoolMints = [fromPoolKeys.baseMint.toBase58(), fromPoolKeys.quoteMint.toBase58()];
    const toPoolMints = [toPoolKeys.baseMint.toBase58(), toPoolKeys.quoteMint.toBase58()];
    const intersectionMints = intersection(fromPoolMints, toPoolMints);
    const _middleMint = intersectionMints[0];
    const middleMint = new PublicKey(_middleMint);
    const tokenAccountMiddle = await this.scope.account.getCreatedTokenAccount({
      mint: middleMint,
    });

    const [amountInRaw, amountOutRaw] = [amountIn.raw, amountOut.raw];

    const txBuilder = this.createTxBuilder();
    const { tokenAccount: _tokenAccountIn, ...accountInInstruction } = await account.handleTokenAccount({
      side: "in",
      amount: amountInRaw,
      mint: tokenIn.mint,
      tokenAccount: tokenAccountIn,
      bypassAssociatedCheck,
      skipCloseAccount: true,
    });
    txBuilder.addInstruction(accountInInstruction);
    const { tokenAccount: _tokenAccountOut, ...accountOutInstruction } = await account.handleTokenAccount({
      side: "out",
      amount: 0,
      mint: tokenOut.mint,
      tokenAccount: tokenAccountOut,
      bypassAssociatedCheck,
      skipCloseAccount: true,
    });
    txBuilder.addInstruction(accountOutInstruction);
    const { tokenAccount: _tokenAccountMiddle, ...accountMiddleInstruction } = await account.handleTokenAccount({
      side: "in",
      amount: 0,
      mint: middleMint,
      tokenAccount: tokenAccountMiddle,
      bypassAssociatedCheck,
      skipCloseAccount: true,
    });
    txBuilder.addInstruction(accountMiddleInstruction);
    txBuilder.addInstruction({
      instructions: makeRouteSwapInstruction({
        fromPoolKeys,
        toPoolKeys,
        userKeys: {
          inTokenAccount: _tokenAccountIn,
          outTokenAccount: _tokenAccountOut,
          middleTokenAccount: _tokenAccountMiddle,
          middleStatusAccount: await getAssociatedMiddleStatusAccount({
            programId: ROUTE_PROGRAM_ID_V1,
            fromPoolId: fromPoolKeys.id,
            middleMint,
            owner: this.scope.ownerPubKey,
          }),
          owner: this.scope.ownerPubKey,
        },
        amountIn: amountInRaw,
        amountOut: amountOutRaw,
        fixedSide,
      }),
    });
    const buildData = await txBuilder.build({ amountOut: amountOutRaw }) as MakeTransaction & SwapExtInfo
    return buildData
  }
}
