import { Connection, Keypair, PublicKey, Signer, Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { AmmV3, AmmV3PoolInfo, ReturnTypeFetchMultiplePoolTickArrays } from "../ammV3";
import { MAX_SQRT_PRICE_X64, MIN_SQRT_PRICE_X64, ONE } from "../ammV3/utils/constants";
import { Base, TokenAccount } from "../base";
import {
  forecastTransactionSize, jsonInfo2PoolKeys, parseSimulateLogToJson, parseSimulateValue, simulateMultipleInstruction,
} from "../common";
import { Currency, CurrencyAmount, Percent, Price, Token, TokenAmount, ZERO } from "../entity";
import {
  initStableModelLayout, Liquidity, LiquidityPoolJsonInfo, LiquidityPoolKeys, LiquidityPoolsJsonFile,
} from "../liquidity";
import { Route } from "../route";

import { route1Instruction, route2Instruction } from "./instrument";

export type PoolType = AmmV3PoolInfo | LiquidityPoolJsonInfo
type RoutePathType = {
  [routeMint: string]: {
    in: PoolType[];
    out: PoolType[];
    mDecimals: number
  }
}


interface poolAccountInfoV4 {
  ammId: string;
  status: BN;
  baseDecimals: number;
  quoteDecimals: number;
  lpDecimals: number;
  baseReserve: BN;
  quoteReserve: BN;
  lpSupply: BN;
  startTime: BN;
}

export interface ComputeAmountOutAmmLayout {
  amountIn: CurrencyAmount | TokenAmount,
  amountOut: CurrencyAmount | TokenAmount,
  minAmountOut: CurrencyAmount | TokenAmount,
  currentPrice: Price | undefined
  executionPrice: Price | null
  priceImpact: Percent
  fee: CurrencyAmount[],
  routeType: 'amm',
  poolKey: PoolType[],
  remainingAccounts: PublicKey[][]
  middleMint: PublicKey | undefined,
  poolReady: boolean
  poolType: string | undefined
}
export interface ComputeAmountOutRouteLayout {
  amountIn: CurrencyAmount | TokenAmount,
  amountOut: CurrencyAmount | TokenAmount,
  minAmountOut: CurrencyAmount | TokenAmount,
  currentPrice: Price | undefined
  executionPrice: Price | null
  priceImpact: Percent
  fee: CurrencyAmount[],
  routeType: 'route',
  poolKey: PoolType[],
  remainingAccounts: PublicKey[][]
  middleMint: PublicKey | undefined,
  poolReady: boolean
  poolType: (string | undefined)[]
}
type ComputeAmountOutLayout = ComputeAmountOutAmmLayout | ComputeAmountOutRouteLayout

type makeSwapInstructionParam = {
  ownerInfo: {
    wallet: PublicKey,
    // tokenAccountA: PublicKey
    // tokenAccountB: PublicKey

    sourceToken: PublicKey,
    routeToken?: PublicKey,
    destinationToken: PublicKey,
    userPdaAccount?: PublicKey,
  },

  inputMint: PublicKey
  routeProgram: PublicKey

  swapInfo: ComputeAmountOutLayout
}

export interface ReturnTypeGetAllRoute {
  directPath: PoolType[];
  addLiquidityPools: LiquidityPoolJsonInfo[];
  routePathDict: RoutePathType;
  needSimulate: LiquidityPoolJsonInfo[];
  needTickArray: AmmV3PoolInfo[];
}
export interface ReturnTypeFetchMultipleInfo { [ammId: string]: poolAccountInfoV4 }
export type ReturnTypeGetAddLiquidityDefaultPool = LiquidityPoolJsonInfo | undefined
export type ReturnTypeGetAllRouteComputeAmountOut = ComputeAmountOutLayout[]
export interface ReturnTypeMakeSwapInstruction {
  signers: (Keypair | Signer)[],
  instructions: TransactionInstruction[]
  address: { [key: string]: PublicKey },
}
export interface ReturnTypeMakeSwapTranscation {
  transactions: {
    transaction: Transaction,
    signer: (Keypair | Signer)[]
  }[],
  address: { [key: string]: PublicKey },
}

export class TradeV2 extends Base {

  static getAllRoute({
    inputMint, outputMint, apiPoolList, ammV3List
  }: {
    inputMint: PublicKey,
    outputMint: PublicKey,

    apiPoolList?: LiquidityPoolsJsonFile
    ammV3List?: AmmV3PoolInfo[]
  }): ReturnTypeGetAllRoute {

    const needSimulate: { [poolKey: string]: LiquidityPoolJsonInfo } = {}
    const needTickArray: { [poolKey: string]: AmmV3PoolInfo } = {}

    const directPath: PoolType[] = []

    const routePathDict: RoutePathType = {} // {[route mint: string]: {in: [] , out: []}}

    for (const itemAmmPool of ammV3List ?? []) {
      if ((itemAmmPool.mintA.mint.equals(inputMint) && itemAmmPool.mintB.mint.equals(outputMint)) || (itemAmmPool.mintA.mint.equals(outputMint) && itemAmmPool.mintB.mint.equals(inputMint))) {
        directPath.push(itemAmmPool)
        needTickArray[itemAmmPool.id.toString()] = itemAmmPool
      }
      if (itemAmmPool.mintA.mint.equals(inputMint)) {
        const t = itemAmmPool.mintB.mint.toString()
        if (routePathDict[t] === undefined) routePathDict[t] = { in: [], out: [], mDecimals: itemAmmPool.mintB.decimals }
        routePathDict[t].in.push(itemAmmPool)
      }
      if (itemAmmPool.mintB.mint.equals(inputMint)) {
        const t = itemAmmPool.mintA.mint.toString()
        if (routePathDict[t] === undefined) routePathDict[t] = { in: [], out: [], mDecimals: itemAmmPool.mintA.decimals }
        routePathDict[t].in.push(itemAmmPool)
      }
      if (itemAmmPool.mintA.mint.equals(outputMint)) {
        const t = itemAmmPool.mintB.mint.toString()
        if (routePathDict[t] === undefined) routePathDict[t] = { in: [], out: [], mDecimals: itemAmmPool.mintB.decimals }
        routePathDict[t].out.push(itemAmmPool)
      }
      if (itemAmmPool.mintB.mint.equals(outputMint)) {
        const t = itemAmmPool.mintA.mint.toString()
        if (routePathDict[t] === undefined) routePathDict[t] = { in: [], out: [], mDecimals: itemAmmPool.mintA.decimals }
        routePathDict[t].out.push(itemAmmPool)
      }
    }

    const addLiquidityPools: LiquidityPoolJsonInfo[] = []

    const _inputMint = inputMint.toString()
    const _outputMint = outputMint.toString()
    for (const itemAmmPool of (apiPoolList ?? {}).official ?? []) {
      if ((itemAmmPool.baseMint === _inputMint && itemAmmPool.quoteMint === _outputMint) || (itemAmmPool.baseMint === _outputMint && itemAmmPool.quoteMint === _inputMint)) {
        directPath.push(itemAmmPool)
        needSimulate[itemAmmPool.id] = itemAmmPool
        addLiquidityPools.push(itemAmmPool)
      }
      if (itemAmmPool.baseMint === _inputMint) {
        if (routePathDict[itemAmmPool.quoteMint] === undefined) routePathDict[itemAmmPool.quoteMint] = { in: [], out: [], mDecimals: itemAmmPool.quoteDecimals }
        routePathDict[itemAmmPool.quoteMint].in.push(itemAmmPool)
      }
      if (itemAmmPool.quoteMint === _inputMint) {
        if (routePathDict[itemAmmPool.baseMint] === undefined) routePathDict[itemAmmPool.baseMint] = { in: [], out: [], mDecimals: itemAmmPool.baseDecimals }
        routePathDict[itemAmmPool.baseMint].in.push(itemAmmPool)
      }
      if (itemAmmPool.baseMint === _outputMint) {
        if (routePathDict[itemAmmPool.quoteMint] === undefined) routePathDict[itemAmmPool.quoteMint] = { in: [], out: [], mDecimals: itemAmmPool.quoteDecimals }
        routePathDict[itemAmmPool.quoteMint].out.push(itemAmmPool)
      }
      if (itemAmmPool.quoteMint === _outputMint) {
        if (routePathDict[itemAmmPool.baseMint] === undefined) routePathDict[itemAmmPool.baseMint] = { in: [], out: [], mDecimals: itemAmmPool.baseDecimals }
        routePathDict[itemAmmPool.baseMint].out.push(itemAmmPool)
      }
    }
    const _insertAddLiquidityPool = addLiquidityPools.length === 0
    for (const itemAmmPool of (apiPoolList ?? {}).unOfficial ?? []) {
      if ((itemAmmPool.baseMint === _inputMint && itemAmmPool.quoteMint === _outputMint) || (itemAmmPool.baseMint === _outputMint && itemAmmPool.quoteMint === _inputMint)) {
        directPath.push(itemAmmPool)
        needSimulate[itemAmmPool.id] = itemAmmPool
        if (_insertAddLiquidityPool) addLiquidityPools.push(itemAmmPool)
      }
      if (itemAmmPool.baseMint === _inputMint) {
        if (routePathDict[itemAmmPool.quoteMint] === undefined) routePathDict[itemAmmPool.quoteMint] = { in: [], out: [], mDecimals: itemAmmPool.quoteDecimals }
        routePathDict[itemAmmPool.quoteMint].in.push(itemAmmPool)
      }
      if (itemAmmPool.quoteMint === _inputMint) {
        if (routePathDict[itemAmmPool.baseMint] === undefined) routePathDict[itemAmmPool.baseMint] = { in: [], out: [], mDecimals: itemAmmPool.baseDecimals }
        routePathDict[itemAmmPool.baseMint].in.push(itemAmmPool)
      }
      if (itemAmmPool.baseMint === _outputMint) {
        if (routePathDict[itemAmmPool.quoteMint] === undefined) routePathDict[itemAmmPool.quoteMint] = { in: [], out: [], mDecimals: itemAmmPool.quoteDecimals }
        routePathDict[itemAmmPool.quoteMint].out.push(itemAmmPool)
      }
      if (itemAmmPool.quoteMint === _outputMint) {
        if (routePathDict[itemAmmPool.baseMint] === undefined) routePathDict[itemAmmPool.baseMint] = { in: [], out: [], mDecimals: itemAmmPool.baseDecimals }
        routePathDict[itemAmmPool.baseMint].out.push(itemAmmPool)
      }
    }


    for (const t of Object.keys(routePathDict)) {
      if (routePathDict[t].in.length === 1 && routePathDict[t].out.length === 1 && String(routePathDict[t].in[0].id) === String(routePathDict[t].out[0].id)) {
        delete routePathDict[t]
        continue
      }
      if (routePathDict[t].in.length === 0 || routePathDict[t].out.length === 0) {
        delete routePathDict[t]
        continue
      }

      const info = routePathDict[t]

      for (const infoIn of info.in) {
        for (const infoOut of info.out) {
          if (infoIn.version === 6 && needTickArray[infoIn.id.toString()] === undefined) {
            needTickArray[infoIn.id.toString()] = infoIn as AmmV3PoolInfo
          } else if (infoIn.version !== 6 && needSimulate[infoIn.id as string] === undefined) {
            needSimulate[infoIn.id as string] = infoIn as LiquidityPoolJsonInfo
          }
          if (infoOut.version === 6 && needTickArray[infoOut.id.toString()] === undefined) {
            needTickArray[infoOut.id.toString()] = infoOut as AmmV3PoolInfo
          } else if (infoOut.version !== 6 && needSimulate[infoOut.id as string] === undefined) {
            needSimulate[infoOut.id as string] = infoOut as LiquidityPoolJsonInfo
          }
        }
      }
    }

    return {
      directPath,
      addLiquidityPools,
      routePathDict,
      needSimulate: Object.values(needSimulate),
      needTickArray: Object.values(needTickArray),
    }
  }

  static async fetchMultipleInfo({
    connection, pools, batchRequest = true
  }: {
    connection: Connection,
    pools: LiquidityPoolJsonInfo[],
    batchRequest?: boolean,
  }): Promise<ReturnTypeFetchMultipleInfo> {
    if (pools.find(i => i.version === 5)) await initStableModelLayout(connection);

    const instructions = pools.map((pool) => Liquidity.makeSimulatePoolInfoInstruction({ poolKeys: jsonInfo2PoolKeys(pool) }));

    const logs = await simulateMultipleInstruction(connection, instructions, "GetPoolData", batchRequest);

    const poolsInfo: ReturnTypeFetchMultipleInfo = {}
    for (const log of logs) {
      const json = parseSimulateLogToJson(log, "GetPoolData");

      const ammId = JSON.parse(json)['amm_id']
      const status = new BN(parseSimulateValue(json, "status"));
      const baseDecimals = Number(parseSimulateValue(json, "coin_decimals"));
      const quoteDecimals = Number(parseSimulateValue(json, "pc_decimals"));
      const lpDecimals = Number(parseSimulateValue(json, "lp_decimals"));
      const baseReserve = new BN(parseSimulateValue(json, "pool_coin_amount"));
      const quoteReserve = new BN(parseSimulateValue(json, "pool_pc_amount"));
      const lpSupply = new BN(parseSimulateValue(json, "pool_lp_supply"));
      // TODO fix it when split stable
      let startTime = "0";
      try {
        startTime = parseSimulateValue(json, "pool_open_time");
      } catch (error) {
        //
      }

      poolsInfo[ammId] = {
        ammId,
        status,
        baseDecimals,
        quoteDecimals,
        lpDecimals,
        baseReserve,
        quoteReserve,
        lpSupply,
        startTime: new BN(startTime),
      }
    }

    return poolsInfo;
  }

  static getAddLiquidityDefaultPool({ addLiquidityPools, poolInfosCache }: {
    addLiquidityPools: LiquidityPoolJsonInfo[]
    poolInfosCache: { [ammId: string]: poolAccountInfoV4 }
  }): ReturnTypeGetAddLiquidityDefaultPool {
    if (addLiquidityPools.length === 0) return undefined
    if (addLiquidityPools.length === 1) return addLiquidityPools[0]
    addLiquidityPools.sort((a, b) => b.version - a.version)
    if (addLiquidityPools[0].version !== addLiquidityPools[1].version) return addLiquidityPools[0]

    const _addLiquidityPools = addLiquidityPools.filter(i => i.version === addLiquidityPools[0].version)

    _addLiquidityPools.sort((a, b) => this.ComparePoolSize(a, b, poolInfosCache))
    return _addLiquidityPools[0]
  }

  private static ComparePoolSize(a: LiquidityPoolJsonInfo, b: LiquidityPoolJsonInfo, ammIdToPoolInfo: { [ammId: string]: poolAccountInfoV4 }) {
    const aInfo = ammIdToPoolInfo[a.id]
    const bInfo = ammIdToPoolInfo[b.id]
    if (aInfo === undefined) return 1
    if (bInfo === undefined) return -1

    if (a.baseMint === b.baseMint) {
      const sub = aInfo.baseReserve.sub(bInfo.baseReserve)
      return sub.gte(ZERO) ? -1 : 1
    } else {
      const sub = aInfo.baseReserve.sub(bInfo.quoteReserve)
      return sub.gte(ZERO) ? -1 : 1
    }
  }

  static getAllRouteComputeAmountOut({ inputTokenAmount, outputToken, directPath, routePathDict, simulateCache, tickCache, slippage, chainTime }: {
    directPath: PoolType[],
    routePathDict: RoutePathType,
    simulateCache: ReturnTypeFetchMultipleInfo,
    tickCache: ReturnTypeFetchMultiplePoolTickArrays,

    inputTokenAmount: CurrencyAmount | TokenAmount,
    outputToken: Token | Currency,
    slippage: Percent,
    chainTime: number
  }): ReturnTypeGetAllRouteComputeAmountOut {
    const amountIn = inputTokenAmount
    const outRoute: ComputeAmountOutLayout[] = []

    for (const itemPool of directPath) {
      if (itemPool.version === 6) {
        try {
          const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee, remainingAccounts } = AmmV3.computeAmountOutFormat({
            poolInfo: itemPool as AmmV3PoolInfo,
            tickArrayCache: tickCache[itemPool.id.toString()],
            amountIn,
            currencyOut: outputToken,
            slippage,
          })
          outRoute.push({ amountIn, amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee: [fee], remainingAccounts: [remainingAccounts], routeType: 'amm', poolKey: [itemPool], middleMint: undefined, poolReady: true, poolType: 'CLMM' })
        } catch (e) {
          // 
        }
      } else {
        try {
          if (![1,6,7].includes(simulateCache[itemPool.id as string].status.toNumber())) continue
          const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } =
            Liquidity.computeAmountOut({
              poolKeys: jsonInfo2PoolKeys(itemPool) as LiquidityPoolKeys,
              poolInfo: simulateCache[itemPool.id as string],
              amountIn,
              currencyOut: outputToken,
              slippage,
            })
          outRoute.push({ amountIn, amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee: [fee], routeType: 'amm', poolKey: [itemPool], remainingAccounts: [], middleMint: undefined, poolReady: simulateCache[itemPool.id as string].startTime.toNumber() < chainTime, poolType: itemPool.version === 5 ? 'STABLE' : undefined  })
        } catch (e) {
          //
        }
      }
    }
    for (const [routeMint, info] of Object.entries(routePathDict)) {
      for (const iFromPool of info.in) {
        if (!simulateCache[iFromPool.id as string] && !tickCache[iFromPool.id.toString()]) continue
        if (iFromPool.version !== 6 && ![1,6,7].includes(simulateCache[iFromPool.id as string].status.toNumber())) continue
        for (const iOutPool of info.out) {
          if (!simulateCache[iOutPool.id as string] && !tickCache[iOutPool.id.toString()]) continue
          if (iOutPool.version !== 6 && ![1,6,7].includes(simulateCache[iOutPool.id as string].status.toNumber())) continue
          try {
            const { amountOut, minAmountOut, executionPrice, priceImpact, fee, remainingAccounts } = TradeV2.computeAmountOut({
              middleMintInfo: {
                mint: new PublicKey(routeMint),
                decimals: info.mDecimals
              },
              amountIn,
              currencyOut: outputToken,
              slippage,

              fromPool: iFromPool,
              toPool: iOutPool,
              simulateCache,
              tickCache
            });
            const infoAPoolOpen = iFromPool.version === 6 ? true : simulateCache[iFromPool.id as string].startTime.toNumber() < chainTime
            const infoBPoolOpen = iOutPool.version === 6 ? true : simulateCache[iOutPool.id as string].startTime.toNumber() < chainTime

            const poolTypeA = iFromPool.version === 6 ? 'CLMM' : iFromPool.version === 5 ? "STABLE" : undefined
            const poolTypeB = iOutPool.version === 6 ? 'CLMM' : iOutPool.version === 5 ? "STABLE" : undefined
            outRoute.push({
              amountIn, amountOut, minAmountOut, currentPrice: undefined, executionPrice, priceImpact, fee, routeType: 'route', poolKey: [iFromPool, iOutPool], remainingAccounts, middleMint: new PublicKey(routeMint), poolReady: infoAPoolOpen && infoBPoolOpen, poolType: [poolTypeA, poolTypeB]
            })
          } catch (e) {
            //
          }
        }
      }
    }

    outRoute.sort((a, b) => (a.amountOut.raw.sub(b.amountOut.raw).gt(ZERO) ? -1 : 1))

    return outRoute
  }

  private static computeAmountOut({
    middleMintInfo,
    amountIn,
    currencyOut,
    slippage,

    fromPool,
    toPool,
    simulateCache,
    tickCache,
  }: {
    middleMintInfo: { mint: PublicKey, decimals: number },
    amountIn: CurrencyAmount | TokenAmount;
    currencyOut: Currency | Token;
    slippage: Percent;

    fromPool: PoolType,
    toPool: PoolType,
    simulateCache: ReturnTypeFetchMultipleInfo,
    tickCache: ReturnTypeFetchMultiplePoolTickArrays,
  }) {
    const middleToken = new Token(middleMintInfo.mint, middleMintInfo.decimals);

    let minMiddleAmountOut
    let firstPriceImpact
    let firstFee
    let firstRemainingAccounts

    const _slippage = new Percent(0, 100)

    if (fromPool.version === 6) {
      const {
        minAmountOut: _minMiddleAmountOut,
        priceImpact: _firstPriceImpact,
        fee: _firstFee,
        remainingAccounts: _firstRemainingAccounts
      } = AmmV3.computeAmountOutFormat({
        poolInfo: fromPool as AmmV3PoolInfo,
        tickArrayCache: tickCache[fromPool.id.toString()],
        amountIn,
        currencyOut: middleToken,
        slippage: _slippage,
      })
      minMiddleAmountOut = _minMiddleAmountOut
      firstPriceImpact = _firstPriceImpact
      firstFee = _firstFee
      firstRemainingAccounts = _firstRemainingAccounts
    } else {
      const {
        minAmountOut: _minMiddleAmountOut,
        priceImpact: _firstPriceImpact,
        fee: _firstFee,
      } = Liquidity.computeAmountOut({
        poolKeys: jsonInfo2PoolKeys(fromPool) as LiquidityPoolKeys,
        poolInfo: simulateCache[fromPool.id as string],
        amountIn,
        currencyOut: middleToken,
        slippage: _slippage,
      });
      minMiddleAmountOut = _minMiddleAmountOut
      firstPriceImpact = _firstPriceImpact
      firstFee = _firstFee
    }

    let amountOut
    let minAmountOut
    let secondPriceImpact
    let secondFee
    let secondRemainingAccounts
    if (toPool.version === 6) {
      const {
        amountOut: _amountOut,
        minAmountOut: _minAmountOut,
        priceImpact: _secondPriceImpact,
        fee: _secondFee,
        remainingAccounts: _secondRemainingAccounts
      } = AmmV3.computeAmountOutFormat({
        poolInfo: toPool as AmmV3PoolInfo,
        tickArrayCache: tickCache[toPool.id.toString()],
        amountIn: minMiddleAmountOut,
        currencyOut,
        slippage,
      })
      amountOut = _amountOut
      minAmountOut = _minAmountOut
      secondPriceImpact = _secondPriceImpact
      secondFee = _secondFee
      secondRemainingAccounts = _secondRemainingAccounts
    } else {
      const {
        amountOut: _amountOut,
        minAmountOut: _minAmountOut,
        priceImpact: _secondPriceImpact,
        fee: _secondFee,
      } = Liquidity.computeAmountOut({
        poolKeys: jsonInfo2PoolKeys(toPool) as LiquidityPoolKeys,
        poolInfo: simulateCache[toPool.id as string],
        amountIn: minMiddleAmountOut,
        currencyOut,
        slippage,
      });
      amountOut = _amountOut
      minAmountOut = _minAmountOut
      secondPriceImpact = _secondPriceImpact
      secondFee = _secondFee
    }

    let executionPrice: Price | null = null;
    const amountInRaw = amountIn.raw;
    const amountOutRaw = amountOut.raw;
    const currencyIn = amountIn instanceof TokenAmount ? amountIn.token : amountIn.currency;
    if (!amountInRaw.isZero() && !amountOutRaw.isZero()) {
      executionPrice = new Price(currencyIn, amountInRaw, currencyOut, amountOutRaw);
    }

    return {
      // middleAmountOut,
      minMiddleAmountOut,
      amountOut,
      minAmountOut,
      executionPrice,
      priceImpact: firstPriceImpact.add(secondPriceImpact),
      fee: [firstFee, secondFee],
      remainingAccounts: [firstRemainingAccounts, secondRemainingAccounts]
    };
  }

  static makeSwapInstruction({ routeProgram, ownerInfo, inputMint, swapInfo }: makeSwapInstructionParam): ReturnTypeMakeSwapInstruction {
    if (swapInfo.routeType === 'amm') {
      if (swapInfo.poolKey[0].version === 6) {
        const _poolKey = swapInfo.poolKey[0] as AmmV3PoolInfo
        const sqrtPriceLimitX64 = inputMint.equals((_poolKey).mintA.mint)
          ? MIN_SQRT_PRICE_X64.add(ONE)
          : MAX_SQRT_PRICE_X64.sub(ONE);

        return AmmV3.makeSwapBaseInInstructions({
          poolInfo: _poolKey,
          ownerInfo: {
            wallet: ownerInfo.wallet,
            tokenAccountA: _poolKey.mintA.mint.equals(inputMint) ? ownerInfo.sourceToken : ownerInfo.destinationToken,
            tokenAccountB: _poolKey.mintA.mint.equals(inputMint) ? ownerInfo.destinationToken : ownerInfo.sourceToken,
          },
          inputMint,
          amountIn: swapInfo.amountIn.raw,
          amountOutMin: swapInfo.minAmountOut.raw,
          sqrtPriceLimitX64,
          remainingAccounts: swapInfo.remainingAccounts[0]
        })
      } else {
        const _poolKey = swapInfo.poolKey[0] as LiquidityPoolJsonInfo

        return {
          signers: [] as Keypair[],
          instructions: [
            Liquidity.makeSwapInstruction({
              poolKeys: jsonInfo2PoolKeys(_poolKey),
              userKeys: {
                tokenAccountIn: ownerInfo.sourceToken,
                tokenAccountOut: ownerInfo.destinationToken,
                owner: ownerInfo.wallet,
              },
              amountIn: swapInfo.amountIn.raw,
              amountOut: swapInfo.minAmountOut.raw,
              fixedSide: "in",
            })
          ],
          address: {} as { [key: string]: PublicKey },
        };
      }
    } else if (swapInfo.routeType === 'route') {
      const poolKey1 = swapInfo.poolKey[0]
      const poolKey2 = swapInfo.poolKey[1]

      return {
        signers: [] as Keypair[],
        instructions: [
          route1Instruction(
            routeProgram,
            poolKey1,
            poolKey2,

            ownerInfo.sourceToken,
            ownerInfo.routeToken!,
            ownerInfo.userPdaAccount!,
            ownerInfo.wallet,

            inputMint,

            swapInfo.amountIn.raw,
            swapInfo.minAmountOut.raw,
            swapInfo.remainingAccounts[0]
          ),
          route2Instruction(
            routeProgram,
            poolKey1,
            poolKey2,

            ownerInfo.routeToken!,
            ownerInfo.destinationToken,
            ownerInfo.userPdaAccount!,
            ownerInfo.wallet,

            swapInfo.middleMint!,

            swapInfo.remainingAccounts[1]
          )
        ],
        address: {} as { [key: string]: PublicKey },
      };
    } else {
      throw Error('route type error')
    }
  }

  static async makeSwapTranscation({ connection, swapInfo, ownerInfo, checkTransaction }: {
    connection: Connection
    swapInfo: ComputeAmountOutLayout,
    ownerInfo: {
      wallet: PublicKey,
      tokenAccounts: TokenAccount[],
      associatedOnly: boolean
    }
    checkTransaction: boolean
  }): Promise<ReturnTypeMakeSwapTranscation> {
    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];

    const signers: Signer[] = []

    const amountIn = swapInfo.amountIn
    const amountOut = swapInfo.amountOut
    const useSolBalance = !(amountIn instanceof TokenAmount)
    const outSolBalance = !(amountOut instanceof TokenAmount)
    const inputMint = amountIn instanceof TokenAmount ? amountIn.token.mint : Token.WSOL.mint
    const middleMint = swapInfo.middleMint!
    const outputMint = amountOut instanceof TokenAmount ? amountOut.token.mint : Token.WSOL.mint

    const routeProgram = new PublicKey('routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS')

    const sourceToken = await this._selectOrCreateTokenAccount({
      mint: inputMint,
      tokenAccounts: useSolBalance ? [] : ownerInfo.tokenAccounts,
      createInfo: useSolBalance ? {
        connection,
        payer: ownerInfo.wallet,
        amount: amountIn.raw,

        frontInstructions,
        endInstructions,
        signers,
      } : undefined,
      owner: ownerInfo.wallet,
      associatedOnly: useSolBalance ? false : ownerInfo.associatedOnly
    })

    if (sourceToken === undefined) {
      throw Error('input account check error')
    }

    const destinationToken = await this._selectOrCreateTokenAccount({
      mint: outputMint,
      tokenAccounts: ownerInfo.tokenAccounts,
      createInfo: {
        connection,
        payer: ownerInfo.wallet,
        amount: 0,

        frontInstructions,
        endInstructions: outSolBalance ? endInstructions : undefined,
        signers,
      },
      owner: ownerInfo.wallet,
      associatedOnly: ownerInfo.associatedOnly
    })

    let routeToken: PublicKey | undefined = undefined
    if (swapInfo.routeType === 'route') {
      routeToken = await this._selectOrCreateTokenAccount({
        mint: middleMint,
        tokenAccounts: ownerInfo.tokenAccounts,
        createInfo: {
          connection,
          payer: ownerInfo.wallet,
          amount: 0,
  
          frontInstructions,
          endInstructions,
          signers,
        },
        owner: ownerInfo.wallet,
        associatedOnly: false
      })
    }

    const ins = this.makeSwapInstruction({
      routeProgram,
      inputMint,
      swapInfo,
      ownerInfo: {
        wallet: ownerInfo.wallet,
        sourceToken,
        routeToken,
        destinationToken: destinationToken!,
        userPdaAccount: swapInfo.poolKey.length === 2 ? Route.getAssociatedMiddleStatusAccount({
          programId: routeProgram, fromPoolId: new PublicKey(String(swapInfo.poolKey[0].id)), owner: ownerInfo.wallet, middleMint: swapInfo.middleMint!
        }) : undefined
      }
    })

    const transactions: {transaction: Transaction, signer: Signer[]}[] = []
    
    const tempIns = [...frontInstructions, ...ins.instructions, ...endInstructions]
    const tempSigner = [...signers, ...ins.signers]
    if (checkTransaction) {
      if (forecastTransactionSize(tempIns, [ownerInfo.wallet, ...tempSigner.map(i => i.publicKey)])) {
        transactions.push({
          transaction: new Transaction().add(...tempIns),
          signer: tempSigner
        })
      } else {
        if (frontInstructions.length > 0) {
          transactions.push({
            transaction: new Transaction().add(...frontInstructions),
            signer: [...signers]
          })
        }
        if (forecastTransactionSize(ins.instructions, [ownerInfo.wallet])) {
          transactions.push({
            transaction: new Transaction().add(...ins.instructions),
            signer: [...ins.signers]
          })
        } else {
          for (const i of ins.instructions) {
            transactions.push({
              transaction: new Transaction().add(i),
              signer: [...ins.signers]
            })
          }
        }
        if (endInstructions.length > 0) {
          transactions.push({
            transaction: new Transaction().add(...endInstructions),
            signer: []
          })
        }
      }
    } else {
      if (swapInfo.routeType === 'amm') {
        transactions.push({
          transaction: new Transaction().add(...tempIns),
          signer: tempSigner
        })
      } else {
        if (frontInstructions.length > 0) {
          transactions.push({
            transaction: new Transaction().add(...frontInstructions),
            signer: [...signers]
          })
        }
        transactions.push({
          transaction: new Transaction().add(...ins.instructions),
          signer: [...ins.signers]
        })
        if (endInstructions.length > 0) {
          transactions.push({
            transaction: new Transaction().add(...endInstructions),
            signer: []
          })
        }
      }
    }

    return {
      transactions,
      address: { ...ins.address }
    }
  }
}