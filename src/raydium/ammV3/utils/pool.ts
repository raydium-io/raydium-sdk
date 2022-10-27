import { PublicKey, Connection } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";

import {
  AmmV3PoolInfo,
  AmmV3PoolRewardInfo,
  AmmV3PoolRewardLayoutInfo,
  ApiAmmV3PoolInfo,
  AmmV3PoolPersonalPosition,
  SDKParsedConcentratedInfo,
  ReturnTypeFetchMultiplePoolInfos,
  ReturnTypeComputeAmountOut,
  ReturnTypeComputeAmountOutFormat,
  ReturnTypeFetchMultiplePoolTickArrays,
} from "../type";
import { Percent } from "../../../module/percent";
import { Price } from "../../../module/price";
import { Token } from "../../../module/token";
import { TokenAmount } from "../../../module/amount";
import { TOKEN_SOL } from "../../token";
import { TokenAccountRaw } from "../../account/types";
import {
  getMultipleAccountsInfo,
  getMultipleAccountsInfoWithCustomFlags,
  BN_ZERO,
  WSOLMint,
  SOLMint,
} from "../../../common";
import { PoolInfoLayout, PositionInfoLayout, TickArrayLayout } from "../layout";
import { NEGATIVE_ONE, Q64, ZERO, MIN_SQRT_PRICE_X64, MAX_SQRT_PRICE_X64, ONE } from "./constants";
import { MathUtil, SwapMath, SqrtPriceMath, LiquidityMath } from "./math";
import { getPdaTickArrayAddress, getPdaPersonalPositionAddress } from "./pda";
import { TickArray, TickUtils, Tick } from "./tick";
import { FETCH_TICKARRAY_COUNT } from "./tickQuery";
import { PositionUtils } from "./position";

export class PoolUtils {
  static async getOutputAmountAndRemainAccounts(
    poolInfo: AmmV3PoolInfo,
    tickArrayCache: { [key: string]: TickArray },
    inputTokenMint: PublicKey,
    inputAmount: BN,
    sqrtPriceLimitX64?: BN,
  ): Promise<{ expectedAmountOut: BN; remainingAccounts: PublicKey[]; executionPrice: BN; feeAmount: BN }> {
    const zeroForOne = inputTokenMint.equals(poolInfo.mintA.mint);

    const allNeededAccounts: PublicKey[] = [];
    const {
      isExist,
      startIndex: firstTickArrayStartIndex,
      nextAccountMeta,
    } = await this.getFirstInitializedTickArray(poolInfo, zeroForOne);
    if (!isExist || !firstTickArrayStartIndex || !nextAccountMeta) {
      throw new Error("Invalid tick array");
    }

    allNeededAccounts.push(nextAccountMeta);
    const {
      amountCalculated: outputAmount,
      accounts: reaminAccounts,
      sqrtPriceX64: executionPrice,
      feeAmount,
    } = await SwapMath.swapCompute(
      poolInfo.programId,
      poolInfo.id,
      tickArrayCache,
      zeroForOne,
      poolInfo.ammConfig.tradeFeeRate,
      poolInfo.liquidity,
      poolInfo.tickCurrent,
      poolInfo.tickSpacing,
      poolInfo.sqrtPriceX64,
      inputAmount,
      firstTickArrayStartIndex,
      sqrtPriceLimitX64,
    );
    allNeededAccounts.push(...reaminAccounts);
    return {
      expectedAmountOut: outputAmount.mul(NEGATIVE_ONE),
      remainingAccounts: allNeededAccounts,
      executionPrice,
      feeAmount,
    };
  }

  static async getFirstInitializedTickArray(
    poolInfo: AmmV3PoolInfo,
    zeroForOne: boolean,
  ): Promise<
    | { isExist: true; startIndex: number; nextAccountMeta: PublicKey }
    | { isExist: false; startIndex: undefined; nextAccountMeta: undefined }
  > {
    const tickArrayBitmap = TickUtils.mergeTickArrayBitmap(poolInfo.tickArrayBitmap);
    const { isInitialized, startIndex } = TickUtils.checkTickArrayIsInitialized(
      tickArrayBitmap,
      poolInfo.tickCurrent,
      poolInfo.tickSpacing,
    );
    if (isInitialized) {
      const { publicKey: address } = await getPdaTickArrayAddress(poolInfo.programId, poolInfo.id, startIndex);
      return {
        isExist: true,
        startIndex,
        nextAccountMeta: address,
      };
    }
    const { isExist, nextStartIndex } = this.nextInitializedTickArrayStartIndex(poolInfo, zeroForOne);
    if (isExist) {
      const { publicKey: address } = await getPdaTickArrayAddress(poolInfo.programId, poolInfo.id, nextStartIndex);
      return {
        isExist: true,
        startIndex: nextStartIndex,
        nextAccountMeta: address,
      };
    }
    return { isExist: false, nextAccountMeta: undefined, startIndex: undefined };
  }

  static nextInitializedTickArrayStartIndex(
    poolInfo: AmmV3PoolInfo,
    zeroForOne: boolean,
  ): { isExist: boolean; nextStartIndex: number } {
    const tickArrayBitmap = TickUtils.mergeTickArrayBitmap(poolInfo.tickArrayBitmap);
    const currentOffset = TickUtils.getTickArrayOffsetInBitmapByTick(poolInfo.tickCurrent, poolInfo.tickSpacing);
    const result: number[] = zeroForOne
      ? TickUtils.searchLowBitFromStart(tickArrayBitmap, currentOffset - 1, 0, 1, poolInfo.tickSpacing)
      : TickUtils.searchHightBitFromStart(tickArrayBitmap, currentOffset, 1024, 1, poolInfo.tickSpacing);

    return result.length > 0 ? { isExist: true, nextStartIndex: result[0] } : { isExist: false, nextStartIndex: 0 };
  }

  static updatePoolRewardInfos({
    chainTime,
    poolLiquidity,
    rewardInfos,
  }: {
    chainTime: number;
    poolLiquidity: BN;
    rewardInfos: AmmV3PoolRewardLayoutInfo[];
  }): AmmV3PoolRewardInfo[] {
    const nRewardInfo: AmmV3PoolRewardInfo[] = [];
    for (const _itemReward of rewardInfos) {
      const itemReward = {
        ..._itemReward,
        perSecond: MathUtil.x64ToDecimal(_itemReward.emissionsPerSecondX64),
        remainingRewards: undefined,
      };

      if (itemReward.tokenMint.equals(PublicKey.default)) continue;
      if (chainTime <= itemReward.openTime.toNumber() || poolLiquidity.eq(ZERO)) {
        nRewardInfo.push(itemReward);
        continue;
      }

      const latestUpdateTime = new BN(Math.min(itemReward.endTime.toNumber(), chainTime));
      const timeDelta = latestUpdateTime.sub(itemReward.lastUpdateTime);
      const rewardGrowthDeltaX64 = MathUtil.mulDivFloor(timeDelta, itemReward.emissionsPerSecondX64, poolLiquidity);
      const rewardGrowthGlobalX64 = itemReward.rewardGrowthGlobalX64.add(rewardGrowthDeltaX64);
      const rewardEmissionedDelta = MathUtil.mulDivFloor(timeDelta, itemReward.emissionsPerSecondX64, Q64);
      const rewardTotalEmissioned = itemReward.rewardTotalEmissioned.add(rewardEmissionedDelta);
      nRewardInfo.push({
        ...itemReward,
        rewardGrowthGlobalX64,
        rewardTotalEmissioned,
        lastUpdateTime: latestUpdateTime,
      });
    }
    return nRewardInfo;
  }

  static async fetchMultiplePoolInfos({
    connection,
    poolKeys,
    chainTime,
    batchRequest = false,
  }: {
    connection: Connection;
    poolKeys: ApiAmmV3PoolInfo[];
    ownerInfo?: { wallet: PublicKey; tokenAccounts: TokenAccountRaw[] };
    chainTime: number;
    batchRequest?: boolean;
  }): Promise<ReturnTypeFetchMultiplePoolInfos> {
    const poolAccountInfos = await getMultipleAccountsInfo(
      connection,
      poolKeys.map((i) => new PublicKey(i.id)),
      { batchRequest },
    );

    const poolsInfo: {
      [id: string]: {
        state: AmmV3PoolInfo;
        positionAccount?: AmmV3PoolPersonalPosition[];
      };
    } = {};

    for (let index = 0; index < poolKeys.length; index++) {
      const apiPoolInfo = poolKeys[index];
      const accountInfo = poolAccountInfos[index];

      if (accountInfo === null) continue;

      const layoutAccountInfo = PoolInfoLayout.decode(accountInfo.data);

      poolsInfo[apiPoolInfo.id] = {
        state: {
          id: new PublicKey(apiPoolInfo.id),
          mintA: {
            mint: layoutAccountInfo.mintA,
            vault: layoutAccountInfo.vaultA,
            decimals: layoutAccountInfo.mintDecimalsA,
          },
          mintB: {
            mint: layoutAccountInfo.mintB,
            vault: layoutAccountInfo.vaultB,
            decimals: layoutAccountInfo.mintDecimalsB,
          },
          observationId: layoutAccountInfo.observationId,
          ammConfig: {
            ...apiPoolInfo.ammConfig,
            id: new PublicKey(apiPoolInfo.ammConfig.id),
          },

          creator: layoutAccountInfo.creator,
          programId: accountInfo.owner,
          version: 6,

          tickSpacing: layoutAccountInfo.tickSpacing,
          liquidity: layoutAccountInfo.liquidity,
          sqrtPriceX64: layoutAccountInfo.sqrtPriceX64,
          currentPrice: SqrtPriceMath.sqrtPriceX64ToPrice(
            layoutAccountInfo.sqrtPriceX64,
            layoutAccountInfo.mintDecimalsA,
            layoutAccountInfo.mintDecimalsB,
          ),
          tickCurrent: layoutAccountInfo.tickCurrent,
          observationIndex: layoutAccountInfo.observationIndex,
          observationUpdateDuration: layoutAccountInfo.observationUpdateDuration,
          feeGrowthGlobalX64A: layoutAccountInfo.feeGrowthGlobalX64A,
          feeGrowthGlobalX64B: layoutAccountInfo.feeGrowthGlobalX64B,
          protocolFeesTokenA: layoutAccountInfo.protocolFeesTokenA,
          protocolFeesTokenB: layoutAccountInfo.protocolFeesTokenB,
          swapInAmountTokenA: layoutAccountInfo.swapInAmountTokenA,
          swapOutAmountTokenB: layoutAccountInfo.swapOutAmountTokenB,
          swapInAmountTokenB: layoutAccountInfo.swapInAmountTokenB,
          swapOutAmountTokenA: layoutAccountInfo.swapOutAmountTokenA,
          tickArrayBitmap: layoutAccountInfo.tickArrayBitmap,

          rewardInfos: PoolUtils.updatePoolRewardInfos({
            chainTime,
            poolLiquidity: layoutAccountInfo.liquidity,
            rewardInfos: layoutAccountInfo.rewardInfos.filter((i) => !i.tokenMint.equals(PublicKey.default)),
          }),

          day: apiPoolInfo.day,
          week: apiPoolInfo.week,
          month: apiPoolInfo.month,
          tvl: apiPoolInfo.tvl,
        },
      };
    }

    return poolsInfo;
  }

  static async fetchMultiplePoolTickArrays({
    connection,
    poolKeys,
    batchRequest,
  }: {
    connection: Connection;
    poolKeys: AmmV3PoolInfo[];
    batchRequest?: boolean;
  }): Promise<ReturnTypeFetchMultiplePoolTickArrays> {
    const tickArraysToPoolId = {};
    const tickArrays: { pubkey: PublicKey }[] = [];
    for (const itemPoolInfo of poolKeys) {
      const tickArrayBitmap = TickUtils.mergeTickArrayBitmap(itemPoolInfo.tickArrayBitmap);
      const currentTickArrayStartIndex = TickUtils.getTickArrayStartIndexByTick(
        itemPoolInfo.tickCurrent,
        itemPoolInfo.tickSpacing,
      );

      const startIndexArray = TickUtils.getInitializedTickArrayInRange(
        tickArrayBitmap,
        itemPoolInfo.tickSpacing,
        currentTickArrayStartIndex,
        Math.floor(FETCH_TICKARRAY_COUNT / 2),
      );
      for (const itemIndex of startIndexArray) {
        const { publicKey: tickArrayAddress } = await getPdaTickArrayAddress(
          itemPoolInfo.programId,
          itemPoolInfo.id,
          itemIndex,
        );
        tickArrays.push({ pubkey: tickArrayAddress });
        tickArraysToPoolId[tickArrayAddress.toString()] = itemPoolInfo.id;
      }
    }

    const fetchedTickArrays = await getMultipleAccountsInfoWithCustomFlags(connection, tickArrays, { batchRequest });

    const tickArrayCache: ReturnTypeFetchMultiplePoolTickArrays = {};

    for (const itemAccountInfo of fetchedTickArrays) {
      if (!itemAccountInfo.accountInfo) continue;
      const poolId = tickArraysToPoolId[itemAccountInfo.pubkey.toString()];
      if (!poolId) continue;
      if (tickArrayCache[poolId] === undefined) tickArrayCache[poolId] = {};

      const accountLayoutData = TickArrayLayout.decode(itemAccountInfo.accountInfo.data);

      tickArrayCache[poolId][accountLayoutData.startTickIndex] = {
        ...accountLayoutData,
        address: itemAccountInfo.pubkey,
      };
    }
    return tickArrayCache;
  }

  static async fetchPoolsAccountPosition({
    pools,
    connection,
    ownerInfo,
    batchRequest = false,
  }: {
    pools: SDKParsedConcentratedInfo[];
    connection: Connection;
    ownerInfo: { wallet: PublicKey; tokenAccounts: TokenAccountRaw[] };
    batchRequest?: boolean;
  }): Promise<SDKParsedConcentratedInfo[]> {
    const programIds: PublicKey[] = [];

    for (let index = 0; index < pools.length; index++) {
      const accountInfo = pools[index];

      if (accountInfo === null) continue;

      if (!programIds.find((i) => i.equals(accountInfo.state.programId))) programIds.push(accountInfo.state.programId);
    }

    if (ownerInfo) {
      const allMint = ownerInfo.tokenAccounts.map((i) => i.accountInfo.mint);
      const allPositionKey: PublicKey[] = [];
      for (const itemMint of allMint) {
        for (const itemProgramId of programIds) {
          allPositionKey.push(await (await getPdaPersonalPositionAddress(itemProgramId, itemMint)).publicKey);
        }
      }
      const positionAccountInfos = await getMultipleAccountsInfo(connection, allPositionKey, { batchRequest });
      const keyToTickArrayAddress: { [key: string]: PublicKey } = {};
      for (const itemAccountInfo of positionAccountInfos) {
        if (itemAccountInfo === null) continue;
        // TODO: add check

        const position = PositionInfoLayout.decode(itemAccountInfo.data);
        const itemPoolId = position.poolId.toString();
        const poolInfoA = pools.find((pool) => pool.state.id.toBase58() === itemPoolId);
        if (poolInfoA === undefined) continue;

        const poolInfo = poolInfoA.state;

        const priceLower = TickUtils.getTickPrice({
          poolInfo,
          tick: position.tickLower,
          baseIn: true,
        });
        const priceUpper = TickUtils.getTickPrice({
          poolInfo,
          tick: position.tickUpper,
          baseIn: true,
        });
        const { amountA, amountB } = LiquidityMath.getAmountsFromLiquidity(
          poolInfo.sqrtPriceX64,
          priceLower.tickSqrtPriceX64,
          priceUpper.tickSqrtPriceX64,
          position.liquidity,
          false,
        );

        const leverage = 1 / (1 - Math.sqrt(Math.sqrt(priceLower.price.div(priceUpper.price).toNumber())));

        poolInfoA.positionAccount = [
          ...(poolInfoA.positionAccount ?? []),
          {
            poolId: position.poolId,
            nftMint: position.nftMint,

            priceLower: priceLower.price,
            priceUpper: priceUpper.price,
            amountA,
            amountB,
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            liquidity: position.liquidity,
            feeGrowthInsideLastX64A: position.feeGrowthInsideLastX64A,
            feeGrowthInsideLastX64B: position.feeGrowthInsideLastX64B,
            tokenFeesOwedA: position.tokenFeesOwedA,
            tokenFeesOwedB: position.tokenFeesOwedB,
            rewardInfos: position.rewardInfos.map((i) => ({
              ...i,
              peddingReward: new BN(0),
            })),

            leverage,
            tokenFeeAmountA: new BN(0),
            tokenFeeAmountB: new BN(0),
          },
        ];

        const tickArrayLowerAddress = await TickUtils.getTickArrayAddressByTick(
          poolInfoA.state.programId,
          position.poolId,
          position.tickLower,
          poolInfoA.state.tickSpacing,
        );
        const tickArrayUpperAddress = await TickUtils.getTickArrayAddressByTick(
          poolInfoA.state.programId,
          position.poolId,
          position.tickUpper,
          poolInfoA.state.tickSpacing,
        );
        keyToTickArrayAddress[
          `${poolInfoA.state.programId.toString()}-${position.poolId.toString()}-${position.tickLower}`
        ] = tickArrayLowerAddress;
        keyToTickArrayAddress[
          `${poolInfoA.state.programId.toString()}-${position.poolId.toString()}-${position.tickUpper}`
        ] = tickArrayUpperAddress;
      }

      const tickArrayKeys = Object.values(keyToTickArrayAddress);
      const tickArrayDatas = await getMultipleAccountsInfo(connection, tickArrayKeys, { batchRequest });
      const tickArrayLayout = {};
      for (let index = 0; index < tickArrayKeys.length; index++) {
        const tickArrayData = tickArrayDatas[index];
        if (tickArrayData === null) continue;
        const key = tickArrayKeys[index].toString();
        tickArrayLayout[key] = TickArrayLayout.decode(tickArrayData.data);
      }

      for (const { state, positionAccount } of pools) {
        if (!positionAccount) continue;
        for (const itemPA of positionAccount) {
          const keyLower = `${state.programId.toString()}-${state.id.toString()}-${itemPA.tickLower}`;
          const keyUpper = `${state.programId.toString()}-${state.id.toString()}-${itemPA.tickUpper}`;
          const tickArrayLower = tickArrayLayout[keyToTickArrayAddress[keyLower].toString()];
          const tickArrayUpper = tickArrayLayout[keyToTickArrayAddress[keyUpper].toString()];
          const tickLowerState: Tick =
            tickArrayLower.ticks[TickUtils.getTickOffsetInArray(itemPA.tickLower, state.tickSpacing)];
          const tickUpperState: Tick =
            tickArrayUpper.ticks[TickUtils.getTickOffsetInArray(itemPA.tickUpper, state.tickSpacing)];
          const { tokenFeeAmountA, tokenFeeAmountB } = await PositionUtils.GetPositionFees(
            state,
            itemPA,
            tickLowerState,
            tickUpperState,
          );
          const rewardInfos = await PositionUtils.GetPositionRewards(state, itemPA, tickLowerState, tickUpperState);
          itemPA.tokenFeeAmountA = tokenFeeAmountA.gte(BN_ZERO) ? tokenFeeAmountA : BN_ZERO;
          itemPA.tokenFeeAmountB = tokenFeeAmountB.gte(BN_ZERO) ? tokenFeeAmountB : BN_ZERO;
          for (let i = 0; i < rewardInfos.length; i++) {
            itemPA.rewardInfos[i].peddingReward = rewardInfos[i].gte(BN_ZERO) ? rewardInfos[i] : BN_ZERO;
          }
        }
      }
    }
    return pools;
  }

  static async computeAmountOut({
    poolInfo,
    tickArrayCache,
    baseMint,
    amountIn,
    slippage,
    priceLimit = new Decimal(0),
  }: {
    poolInfo: AmmV3PoolInfo;
    tickArrayCache: { [key: string]: TickArray };
    baseMint: PublicKey;

    amountIn: BN;
    slippage: number;
    priceLimit?: Decimal;
  }): Promise<ReturnTypeComputeAmountOut> {
    let sqrtPriceLimitX64: BN;
    if (priceLimit.equals(new Decimal(0))) {
      sqrtPriceLimitX64 = baseMint.equals(poolInfo.mintA.mint)
        ? MIN_SQRT_PRICE_X64.add(ONE)
        : MAX_SQRT_PRICE_X64.sub(ONE);
    } else {
      sqrtPriceLimitX64 = SqrtPriceMath.priceToSqrtPriceX64(
        priceLimit,
        poolInfo.mintA.decimals,
        poolInfo.mintB.decimals,
      );
    }

    const {
      expectedAmountOut,
      remainingAccounts,
      executionPrice: _executionPriceX64,
      feeAmount,
    } = await PoolUtils.getOutputAmountAndRemainAccounts(
      poolInfo,
      tickArrayCache,
      baseMint,
      amountIn,
      sqrtPriceLimitX64,
    );

    const _executionPrice = SqrtPriceMath.sqrtPriceX64ToPrice(
      _executionPriceX64,
      poolInfo.mintA.decimals,
      poolInfo.mintB.decimals,
    );
    const executionPrice = baseMint.equals(poolInfo.mintA.mint) ? _executionPrice : new Decimal(1).div(_executionPrice);

    const minAmountOut = expectedAmountOut
      .mul(new BN(Math.floor((1 - slippage) * 10000000000)))
      .div(new BN(10000000000));

    const poolPrice = poolInfo.mintA.mint.equals(baseMint)
      ? poolInfo.currentPrice
      : new Decimal(1).div(poolInfo.currentPrice);
    const priceImpact = new Percent(
      parseInt(String(Math.abs(parseFloat(executionPrice.toFixed()) - parseFloat(poolPrice.toFixed())) * 1e9)),
      parseInt(String(parseFloat(poolPrice.toFixed()) * 1e9)),
    );

    return {
      amountOut: expectedAmountOut,
      minAmountOut,
      currentPrice: poolInfo.currentPrice,
      executionPrice,
      priceImpact,
      fee: feeAmount,

      remainingAccounts,
    };
  }

  static async computeAmountOutFormat({
    poolInfo,
    tickArrayCache,
    amountIn,
    tokenOut: _tokenOut,
    slippage,
  }: {
    poolInfo: AmmV3PoolInfo;
    tickArrayCache: { [key: string]: TickArray };

    amountIn: TokenAmount;
    tokenOut: Token;
    slippage: Percent;
  }): Promise<ReturnTypeComputeAmountOutFormat> {
    const inputMint = amountIn.token.equals(Token.WSOL) ? WSOLMint : amountIn.token.mint;
    const _slippage = slippage.numerator.toNumber() / slippage.denominator.toNumber();
    const tokenOut = _tokenOut.mint.equals(SOLMint)
      ? new Token({ mint: "sol", decimals: TOKEN_SOL.decimals })
      : _tokenOut;

    const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee, remainingAccounts } =
      await this.computeAmountOut({
        poolInfo,
        tickArrayCache,
        baseMint: inputMint,
        amountIn: amountIn.raw,
        slippage: _slippage,
      });

    return {
      amountOut: new TokenAmount(tokenOut, amountOut),
      minAmountOut: new TokenAmount(tokenOut, minAmountOut),
      currentPrice: new Price({
        baseToken: amountIn.token,
        denominator: new BN(10).pow(new BN(20 + amountIn.token.decimals)),
        quoteToken: tokenOut,
        numerator: currentPrice.mul(new Decimal(10 ** (20 + tokenOut.decimals))).toFixed(0),
      }),
      executionPrice: new Price({
        baseToken: amountIn.token,
        denominator: new BN(10).pow(new BN(20 + amountIn.token.decimals)),
        quoteToken: tokenOut,
        numerator: executionPrice.mul(new Decimal(10 ** (20 + tokenOut.decimals))).toFixed(0),
      }),
      priceImpact,
      fee: new TokenAmount(amountIn.token, fee),
      remainingAccounts,
    };
  }

  static estimateAprsForPriceRangeMultiplier({
    poolInfo,
    aprType,
    positionTickLowerIndex,
    positionTickUpperIndex,
  }: {
    poolInfo: AmmV3PoolInfo;
    aprType: "day" | "week" | "month";

    positionTickLowerIndex: number;
    positionTickUpperIndex: number;
  }): {
    feeApr: number;
    rewardsApr: number[];
    apr: number;
  } {
    const aprInfo = poolInfo[aprType];

    const priceLower = TickUtils.getTickPrice({
      poolInfo,
      tick: positionTickLowerIndex,
      baseIn: true,
    }).price.toNumber();
    const priceUpper = TickUtils.getTickPrice({
      poolInfo,
      tick: positionTickUpperIndex,
      baseIn: true,
    }).price.toNumber();

    const _minPrice = Math.max(priceLower, aprInfo.priceMin);
    const _maxPrice = Math.min(priceUpper, aprInfo.priceMax);

    const sub = _maxPrice - _minPrice;

    const userRange = priceUpper - priceLower;
    const tradeRange = aprInfo.priceMax - aprInfo.priceMin;

    let p;

    if (sub <= 0) p = 0;
    else if (userRange === sub) p = tradeRange / sub;
    else if (tradeRange === sub) p = sub / userRange;
    else p = (sub / tradeRange) * (sub / userRange);

    return {
      feeApr: aprInfo.feeApr * p,
      rewardsApr: [aprInfo.rewardApr.A * p, aprInfo.rewardApr.B * p, aprInfo.rewardApr.C * p],
      apr: aprInfo.apr * p,
    };
  }

  static estimateAprsForPriceRangeDelta({
    poolInfo,
    aprType,
    mintPrice,
    rewardMintDecimals,
    liquidity,
    positionTickLowerIndex,
    positionTickUpperIndex,
    chainTime,
  }: {
    poolInfo: AmmV3PoolInfo;
    aprType: "day" | "week" | "month";

    mintPrice: { [mint: string]: Price };

    rewardMintDecimals: { [mint: string]: number };

    liquidity: BN;
    positionTickLowerIndex: number;
    positionTickUpperIndex: number;

    chainTime: number;
  }): {
    feeApr: number;
    rewardsApr: number[];
    apr: number;
  } {
    const aprTypeDay = aprType === "day" ? 1 : aprType === "week" ? 7 : aprType === "month" ? 30 : 0;
    const aprInfo = poolInfo[aprType];
    const mintPriceA = mintPrice[poolInfo.mintA.mint.toString()];
    const mintPriceB = mintPrice[poolInfo.mintB.mint.toString()];
    const mintDecimalsA = poolInfo.mintA.decimals;
    const mintDecimalsB = poolInfo.mintB.decimals;

    if (!aprInfo || !mintPriceA || !mintPriceB) return { feeApr: 0, rewardsApr: [0, 0, 0], apr: 0 };

    const sqrtPriceX64A = SqrtPriceMath.getSqrtPriceX64FromTick(positionTickLowerIndex);
    const sqrtPriceX64B = SqrtPriceMath.getSqrtPriceX64FromTick(positionTickUpperIndex);

    const { amountSlippageA: poolLiquidityA, amountSlippageB: poolLiquidityB } =
      LiquidityMath.getAmountsFromLiquidityWithSlippage(
        poolInfo.sqrtPriceX64,
        sqrtPriceX64A,
        sqrtPriceX64B,
        poolInfo.liquidity,
        false,
        false,
        0,
      );
    const { amountSlippageA: userLiquidityA, amountSlippageB: userLiquidityB } =
      LiquidityMath.getAmountsFromLiquidityWithSlippage(
        poolInfo.sqrtPriceX64,
        sqrtPriceX64A,
        sqrtPriceX64B,
        liquidity,
        false,
        false,
        0,
      );

    const poolTvl = new Decimal(poolLiquidityA.toString())
      .div(new Decimal(10).pow(mintDecimalsA))
      .mul(mintPriceA.toFixed(mintDecimalsA))
      .add(
        new Decimal(poolLiquidityB.toString())
          .div(new Decimal(10).pow(mintDecimalsB))
          .mul(mintPriceB.toFixed(mintDecimalsB)),
      );
    const userTvl = new Decimal(userLiquidityA.toString())
      .div(new Decimal(10).pow(mintDecimalsA))
      .mul(mintPriceA.toFixed(mintDecimalsA))
      .add(
        new Decimal(userLiquidityB.toString())
          .div(new Decimal(10).pow(mintDecimalsB))
          .mul(mintPriceB.toFixed(mintDecimalsB)),
      );

    const p = userTvl.div(poolTvl.add(userTvl)).div(userTvl);

    const feesPerYear = new Decimal(aprInfo.volumeFee).mul(365).div(aprTypeDay);
    const feeApr = feesPerYear.mul(p).mul(100).toNumber();

    const SECONDS_PER_YEAR = 3600 * 24 * 365;

    const rewardsApr = poolInfo.rewardInfos.map((i) => {
      const iDecimal = rewardMintDecimals[i.tokenMint.toString()];
      const iPrice = mintPrice[i.tokenMint.toString()];

      if (
        chainTime < i.openTime.toNumber() ||
        chainTime > i.endTime.toNumber() ||
        i.perSecond.equals(0) ||
        !iPrice ||
        iDecimal === undefined
      )
        return 0;

      return new Decimal(iPrice.toFixed(iDecimal))
        .mul(i.perSecond.mul(SECONDS_PER_YEAR))
        .div(new Decimal(10).pow(iDecimal))
        .mul(p)
        .mul(100)
        .toNumber();
    });

    return {
      feeApr,
      rewardsApr,
      apr: feeApr + rewardsApr.reduce((a, b) => a + b, 0),
    };
  }
}
