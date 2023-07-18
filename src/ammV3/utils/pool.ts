import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

import { ApiAmmV3PoolsItem } from '../../baseInfo';
import { ZERO } from '../../entity';
import {
  AmmV3PoolInfo, AmmV3PoolRewardInfo, AmmV3PoolRewardLayoutInfo,
} from '../ammV3';

import { NEGATIVE_ONE, Q64 } from './constants';
import { MathUtil, SwapMath } from './math';
import { getPdaTickArrayAddress } from './pda';
import { TickArray, TickUtils } from './tick';

export class PoolUtils {
  public static getOutputAmountAndRemainAccounts(
    poolInfo: AmmV3PoolInfo,
    tickArrayCache: { [key: string]: TickArray },
    inputTokenMint: PublicKey,
    inputAmount: BN,
    sqrtPriceLimitX64?: BN
  ) {
    const zeroForOne = inputTokenMint.equals(poolInfo.mintA.mint);

    const allNeededAccounts: PublicKey[] = [];
    const { isExist, startIndex: firstTickArrayStartIndex, nextAccountMeta } = this.getFirstInitializedTickArray(poolInfo, zeroForOne);
    if (!isExist || firstTickArrayStartIndex === undefined || !nextAccountMeta) throw new Error("Invalid tick array");

    try {
      const preTick = this.preInitializedTickArrayStartIndex(poolInfo, !zeroForOne)
      if (preTick.isExist) {
        const { publicKey: address } = getPdaTickArrayAddress(
          poolInfo.programId,
          poolInfo.id,
          preTick.nextStartIndex
        );
        allNeededAccounts.push(address)
      }
    } catch (e) { /* empty */ }

    allNeededAccounts.push(nextAccountMeta);
    const {
      amountCalculated: outputAmount,
      accounts: reaminAccounts,
      sqrtPriceX64: executionPrice,
      feeAmount
    } = SwapMath.swapCompute(
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
      sqrtPriceLimitX64
    );
    allNeededAccounts.push(...reaminAccounts);
    return { expectedAmountOut: outputAmount.mul(NEGATIVE_ONE), remainingAccounts: allNeededAccounts, executionPrice, feeAmount };
  }

  public static getInputAmountAndRemainAccounts(
    poolInfo: AmmV3PoolInfo,
    tickArrayCache: { [key: string]: TickArray },
    outputTokenMint: PublicKey,
    outputAmount: BN,
    sqrtPriceLimitX64?: BN,
  ) {
    const zeroForOne = outputTokenMint.equals(poolInfo.mintB.mint);

    const allNeededAccounts: PublicKey[] = [];
    const { isExist, startIndex: firstTickArrayStartIndex, nextAccountMeta } = this.getFirstInitializedTickArray(poolInfo, zeroForOne);
    if (!isExist || firstTickArrayStartIndex === undefined || !nextAccountMeta) throw new Error("Invalid tick array");

    try {
      const preTick = this.preInitializedTickArrayStartIndex(poolInfo, !zeroForOne)
      if (preTick.isExist) {
        const { publicKey: address } = getPdaTickArrayAddress(
          poolInfo.programId,
          poolInfo.id,
          preTick.nextStartIndex
        );
        allNeededAccounts.push(address)
      }
    } catch (e) { /* empty */ }

    allNeededAccounts.push(nextAccountMeta);
    const {
      amountCalculated: inputAmount,
      accounts: reaminAccounts,
      sqrtPriceX64: executionPrice,
      feeAmount
    } = SwapMath.swapCompute(
      poolInfo.programId,
      poolInfo.id,
      tickArrayCache,
      zeroForOne,
      poolInfo.ammConfig.tradeFeeRate,
      poolInfo.liquidity,
      poolInfo.tickCurrent,
      poolInfo.tickSpacing,
      poolInfo.sqrtPriceX64,
      outputAmount.mul(NEGATIVE_ONE),
      firstTickArrayStartIndex,
      sqrtPriceLimitX64
    );
    allNeededAccounts.push(...reaminAccounts);
    return { expectedAmountIn: inputAmount, remainingAccounts: allNeededAccounts, executionPrice, feeAmount };
  }

  public static getFirstInitializedTickArray(
    poolInfo: AmmV3PoolInfo,
    zeroForOne: boolean
  ): { isExist: true, startIndex: number, nextAccountMeta: PublicKey } | { isExist: false, startIndex: undefined, nextAccountMeta: undefined } {
    const tickArrayBitmap = TickUtils.mergeTickArrayBitmap(
      poolInfo.tickArrayBitmap
    );
    const { isInitialized, startIndex } = TickUtils.checkTickArrayIsInitialized(
      tickArrayBitmap,
      poolInfo.tickCurrent,
      poolInfo.tickSpacing
    );
    if (isInitialized) {
      const { publicKey: address } = getPdaTickArrayAddress(
        poolInfo.programId,
        poolInfo.id,
        startIndex
      );
      return {
        isExist: true,
        startIndex,
        nextAccountMeta: address
      }
    }
    const { isExist, nextStartIndex } = this.nextInitializedTickArrayStartIndex(poolInfo, zeroForOne);
    if (isExist) {
      const { publicKey: address } = getPdaTickArrayAddress(
        poolInfo.programId,
        poolInfo.id,
        nextStartIndex
      );
      return {
        isExist: true,
        startIndex: nextStartIndex,
        nextAccountMeta: address
      }
    }
    return { isExist: false, nextAccountMeta: undefined, startIndex: undefined }
  }

  public static preInitializedTickArrayStartIndex(
    poolInfo: AmmV3PoolInfo,
    zeroForOne: boolean) {
    const tickArrayBitmap = TickUtils.mergeTickArrayBitmap(
      poolInfo.tickArrayBitmap
    );
    const currentOffset = TickUtils.getTickArrayOffsetInBitmapByTick(
      poolInfo.tickCurrent,
      poolInfo.tickSpacing
    );
    const result: number[] = zeroForOne ? TickUtils.searchLowBitFromStart(
      tickArrayBitmap,
      currentOffset - 1,
      0,
      1,
      poolInfo.tickSpacing
    ) : TickUtils.searchHightBitFromStart(
      tickArrayBitmap,
      currentOffset + 1,
      1024,
      1,
      poolInfo.tickSpacing
    );

    return result.length > 0 ? { isExist: true, nextStartIndex: result[0] } : { isExist: false, nextStartIndex: 0 }
  }

  public static nextInitializedTickArrayStartIndex(
    poolInfo: AmmV3PoolInfo,
    zeroForOne: boolean) {
    const tickArrayBitmap = TickUtils.mergeTickArrayBitmap(
      poolInfo.tickArrayBitmap
    );
    const currentOffset = TickUtils.getTickArrayOffsetInBitmapByTick(
      poolInfo.tickCurrent,
      poolInfo.tickSpacing
    );
    const result: number[] = zeroForOne ? TickUtils.searchLowBitFromStart(
      tickArrayBitmap,
      currentOffset - 1,
      0,
      1,
      poolInfo.tickSpacing
    ) : TickUtils.searchHightBitFromStart(
      tickArrayBitmap,
      currentOffset,
      1024,
      1,
      poolInfo.tickSpacing
    );

    return result.length > 0 ? { isExist: true, nextStartIndex: result[0] } : { isExist: false, nextStartIndex: 0 }
  }

  public static async updatePoolRewardInfos({ connection, apiPoolInfo, chainTime, poolLiquidity, rewardInfos }: {
    connection: Connection,
    apiPoolInfo: ApiAmmV3PoolsItem,
    chainTime: number,
    poolLiquidity: BN,
    rewardInfos: AmmV3PoolRewardLayoutInfo[],
  }) {
    const nRewardInfo: AmmV3PoolRewardInfo[] = []
    for (let i = 0 ; i < rewardInfos.length; i++) {
      const _itemReward = rewardInfos[i]
      const apiRewardProgram = apiPoolInfo.rewardInfos[i]?.programId ?? (await connection.getAccountInfo(_itemReward.tokenMint))?.owner
      if (apiRewardProgram === undefined) throw Error('get new reward mint info error')

      const itemReward: AmmV3PoolRewardInfo = {
        ..._itemReward,
        perSecond: MathUtil.x64ToDecimal(_itemReward.emissionsPerSecondX64),
        remainingRewards: undefined,
        tokenProgramId: new PublicKey(apiRewardProgram),
      }

      if (itemReward.tokenMint.equals(PublicKey.default)) continue
      if (chainTime <= itemReward.openTime.toNumber() || poolLiquidity.eq(ZERO)) {
        nRewardInfo.push(itemReward)
        continue
      }

      const latestUpdateTime = new BN(Math.min(itemReward.endTime.toNumber(), chainTime))
      const timeDelta = latestUpdateTime.sub(itemReward.lastUpdateTime)
      const rewardGrowthDeltaX64 = MathUtil.mulDivFloor(
        timeDelta,
        itemReward.emissionsPerSecondX64,
        poolLiquidity
      );
      const rewardGrowthGlobalX64 = itemReward.rewardGrowthGlobalX64.add(rewardGrowthDeltaX64)
      const rewardEmissionedDelta = MathUtil.mulDivFloor(
        timeDelta,
        itemReward.emissionsPerSecondX64,
        Q64
      )
      const rewardTotalEmissioned = itemReward.rewardTotalEmissioned.add(rewardEmissionedDelta)
      nRewardInfo.push({
        ...itemReward,
        rewardGrowthGlobalX64,
        rewardTotalEmissioned,
        lastUpdateTime: latestUpdateTime
      })
    }
    return nRewardInfo
  }
}
