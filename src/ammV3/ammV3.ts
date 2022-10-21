import {
  Connection, Keypair, PublicKey, Signer, SystemProgram, Transaction, TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";

import { Base, TokenAccount } from "../base";
import { getMultipleAccountsInfo, getMultipleAccountsInfoWithCustomFlags, Logger } from "../common";
import { Currency, CurrencyAmount, Percent, Price, Token, TokenAmount, ZERO } from "../entity";
import { WSOL } from "../token";

import {
  addComputations, closePositionInstruction, collectRewardInstruction, createPoolInstruction,
  decreaseLiquidityInstruction, increaseLiquidityInstruction, initRewardInstruction, openPositionInstruction,
  setRewardInstruction, swapInstruction,
} from "./instrument";
import { ObservationInfoLayout, PoolInfoLayout, PositionInfoLayout, TickArrayLayout } from "./layout";
import { MAX_SQRT_PRICE_X64, MIN_SQRT_PRICE_X64, ONE } from "./utils/constants";
import { LiquidityMath, MathUtil, SqrtPriceMath, TickMath } from "./utils/math";
import {
  getATAAddress, getPdaMetadataKey, getPdaPersonalPositionAddress, getPdaPoolId, getPdaPoolRewardVaulId,
  getPdaPoolVaultId, getPdaProtocolPositionAddress, getPdaTickArrayAddress,
} from "./utils/pda";
import { PoolUtils } from "./utils/pool";
import { PositionUtils } from "./utils/position";
import { Tick, TickArray, TickUtils } from "./utils/tick";
import { FETCH_TICKARRAY_COUNT } from "./utils/tickQuery";

const logger = Logger.from("AmmV3");

export interface ApiAmmV3Point {
  price: string,
  liquidity: string
}

export interface ApiAmmV3ConfigInfo {
  id: string;
  index: number;
  protocolFeeRate: number;
  tradeFeeRate: number;
  tickSpacing: number;
  description: string;
}
export interface ApiAmmV3ConfigInfos { [configId: string]: ApiAmmV3ConfigInfo }

export interface AmmV3ConfigInfo {
  id: PublicKey;
  index: number;
  protocolFeeRate: number;
  tradeFeeRate: number;
  tickSpacing: number;
  description: string;
}
export interface ApiAmmV3PoolInfo {
  id: string
  mintA: string
  mintB: string
  mintDecimalsA: number,
  mintDecimalsB: number,

  ammConfig: ApiAmmV3ConfigInfo,

  day: {
    volume: number,
    volumeFee: number
    feeA: number,
    feeB: number
    feeApr: number
    rewardApr: {
      A: number,
      B: number,
      C: number
    }
    apr: number

    priceMin: number
    priceMax: number
  },
  week: {
    volume: number,
    volumeFee: number
    feeA: number,
    feeB: number
    feeApr: number
    rewardApr: {
      A: number,
      B: number,
      C: number
    }
    apr: number

    priceMin: number
    priceMax: number
  },
  month: {
    volume: number,
    volumeFee: number
    feeA: number,
    feeB: number
    feeApr: number
    rewardApr: {
      A: number,
      B: number,
      C: number
    }
    apr: number

    priceMin: number
    priceMax: number
  },

  tvl: number
}

export interface AmmV3PoolRewardLayoutInfo {
  rewardState: number;
  openTime: BN;
  endTime: BN;
  lastUpdateTime: BN;
  emissionsPerSecondX64: BN;
  rewardTotalEmissioned: BN;
  rewardClaimed: BN;
  tokenMint: PublicKey;
  tokenVault: PublicKey;
  authority: PublicKey;
  rewardGrowthGlobalX64: BN;
}

export interface AmmV3PoolRewardInfo {
  rewardState: number;
  openTime: BN;
  endTime: BN;
  lastUpdateTime: BN;
  emissionsPerSecondX64: BN;
  rewardTotalEmissioned: BN;
  rewardClaimed: BN;
  tokenMint: PublicKey;
  tokenVault: PublicKey;
  authority: PublicKey;
  rewardGrowthGlobalX64: BN;
  perSecond: Decimal
}
export interface AmmV3PoolInfo {
  id: PublicKey,
  mintA: {
    mint: PublicKey,
    vault: PublicKey,
    decimals: number
  },
  mintB: {
    mint: PublicKey,
    vault: PublicKey,
    decimals: number
  },

  ammConfig: AmmV3ConfigInfo,
  observationId: PublicKey,

  programId: PublicKey,
  version: 6,

  tickSpacing: number,
  liquidity: BN,
  sqrtPriceX64: BN,
  currentPrice: Decimal,
  tickCurrent: number,
  observationIndex: number,
  observationUpdateDuration: number,
  feeGrowthGlobalX64A: BN,
  feeGrowthGlobalX64B: BN,
  protocolFeesTokenA: BN,
  protocolFeesTokenB: BN,
  swapInAmountTokenA: BN,
  swapOutAmountTokenB: BN,
  swapInAmountTokenB: BN,
  swapOutAmountTokenA: BN,
  tickArrayBitmap: BN[]

  rewardInfos: AmmV3PoolRewardInfo[]

  day: {
    volume: number,
    volumeFee: number
    feeA: number,
    feeB: number
    feeApr: number
    rewardApr: {
      A: number,
      B: number,
      C: number
    }
    apr: number

    priceMin: number
    priceMax: number
  },
  week: {
    volume: number,
    volumeFee: number
    feeA: number,
    feeB: number
    feeApr: number
    rewardApr: {
      A: number,
      B: number,
      C: number
    }
    apr: number

    priceMin: number
    priceMax: number
  },
  month: {
    volume: number,
    volumeFee: number
    feeA: number,
    feeB: number
    feeApr: number
    rewardApr: {
      A: number,
      B: number,
      C: number
    }
    apr: number

    priceMin: number
    priceMax: number
  },
  tvl: number
}
export interface AmmV3PoolPersonalPosition {
  poolId: PublicKey,
  nftMint: PublicKey,

  priceLower: Decimal,
  priceUpper: Decimal,
  amountA: BN,
  amountB: BN
  tickLower: number
  tickUpper: number
  liquidity: BN
  feeGrowthInsideLastX64A: BN
  feeGrowthInsideLastX64B: BN
  tokenFeesOwedA: BN
  tokenFeesOwedB: BN
  rewardInfos: {
    growthInsideLastX64: BN;
    rewardAmountOwed: BN;
    peddingReward: BN
  }[]

  leverage: number
  tokenFeeAmountA: BN,
  tokenFeeAmountB: BN,
}

export interface MintInfo {
  mint: PublicKey,
  decimals: number
}

export interface ReturnTypeMakeTransaction {
  signers: (Signer | Keypair)[],
  transaction: Transaction,
  address: { [name: string]: PublicKey }
}

export interface ReturnTypeMakeCreatePoolTransaction {
  signers: (Signer | Keypair)[],
  transaction: Transaction,
  mockPoolInfo: AmmV3PoolInfo
}
export interface ReturnTypeMakeInstructions {
  signers: (Signer | Keypair)[],
  instructions: TransactionInstruction[],
  address: { [name: string]: PublicKey }
}
export interface ReturnTypeGetLiquidityAmountOutFromAmountIn {
  liquidity: BN,
  amountSlippageA: BN,
  amountSlippageB: BN,
  amountA: BN,
  amountB: BN
}
export interface ReturnTypeGetAmountsFromLiquidity {
  amountSlippageA: BN;
  amountSlippageB: BN;
}
export interface ReturnTypeGetPriceAndTick {
  tick: number,
  price: Decimal
}
export interface ReturnTypeGetTickPrice {
  tick: number,
  price: Decimal,
  tickSqrtPriceX64: BN
}
export interface ReturnTypeComputeAmountOutFormat {
  amountOut: CurrencyAmount,
  minAmountOut: CurrencyAmount,
  currentPrice: Price,
  executionPrice: Price,
  priceImpact: Percent,
  fee: CurrencyAmount,
  remainingAccounts: PublicKey[]
}
export interface ReturnTypeComputeAmountOut {
  amountOut: BN,
  minAmountOut: BN,
  currentPrice: Decimal,
  executionPrice: Decimal,
  priceImpact: Percent,
  fee: BN,
  remainingAccounts: PublicKey[]
}
export interface ReturnTypeFetchMultiplePoolInfos {
  [id: string]: {
    state: AmmV3PoolInfo;
    positionAccount?: AmmV3PoolPersonalPosition[] | undefined;
  };
}
export interface ReturnTypeFetchMultiplePoolTickArrays { [poolId: string]: { [key: string]: TickArray } }

export class AmmV3 extends Base {
  // transaction
  static async makeCreatePoolTransaction({
    connection,
    programId,
    owner,
    mint1,
    mint2,
    ammConfig,
    initialPrice
  }: {
    connection: Connection,
    programId: PublicKey,
    owner: PublicKey,
    mint1: MintInfo,
    mint2: MintInfo,
    ammConfig: AmmV3ConfigInfo,
    initialPrice: Decimal
  }): Promise<ReturnTypeMakeCreatePoolTransaction> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const [mintA, mintB, initPrice] = mint1.mint._bn.gt(mint2.mint._bn) ? [mint2, mint1, (new Decimal(1)).div(initialPrice)] : [mint1, mint2, initialPrice];

    const initialPriceX64 = SqrtPriceMath.priceToSqrtPriceX64(initPrice, mintA.decimals, mintB.decimals);

    const transaction = new Transaction()
    transaction.add(addComputations())

    const insInfo = await this.makeCreatePoolInstructions({
      connection,
      programId,
      owner,
      mintA,
      mintB,
      ammConfigId: ammConfig.id,
      initialPriceX64
    })

    transaction.add(...insInfo.instructions)

    return {
      signers: insInfo.signers,
      transaction,
      mockPoolInfo: {
        id: insInfo.address.poolId,
        mintA: {
          mint: mintA.mint,
          vault: insInfo.address.mintAVault,
          decimals: mintA.decimals
        },
        mintB: {
          mint: mintB.mint,
          vault: insInfo.address.mintBVault,
          decimals: mintB.decimals
        },

        ammConfig,
        observationId: insInfo.address.observationId,

        programId,
        version: 6,

        tickSpacing: ammConfig.tickSpacing,
        liquidity: ZERO,
        sqrtPriceX64: initialPriceX64,
        currentPrice: initPrice,
        tickCurrent: 0,
        observationIndex: 0,
        observationUpdateDuration: 0,
        feeGrowthGlobalX64A: ZERO,
        feeGrowthGlobalX64B: ZERO,
        protocolFeesTokenA: ZERO,
        protocolFeesTokenB: ZERO,
        swapInAmountTokenA: ZERO,
        swapOutAmountTokenB: ZERO,
        swapInAmountTokenB: ZERO,
        swapOutAmountTokenA: ZERO,
        tickArrayBitmap: [],

        rewardInfos: [],

        day: { volume: 0, volumeFee: 0, feeA: 0, feeB: 0, feeApr: 0, rewardApr: { A: 0, B: 0, C: 0 }, apr: 0, priceMax: 0, priceMin: 0},
        week: { volume: 0, volumeFee: 0, feeA: 0, feeB: 0, feeApr: 0, rewardApr: { A: 0, B: 0, C: 0 }, apr: 0, priceMax: 0, priceMin: 0 },
        month: { volume: 0, volumeFee: 0, feeA: 0, feeB: 0, feeApr: 0, rewardApr: { A: 0, B: 0, C: 0 }, apr: 0, priceMax: 0, priceMin: 0 },
        tvl: 0
      }
    }
  }

  static async makeOpenPositionTransaction(
    { connection, poolInfo, ownerInfo, tickLower, tickUpper, liquidity, slippage, associatedOnly = true }: {
      connection: Connection,
      poolInfo: AmmV3PoolInfo,

      ownerInfo: {
        feePayer: PublicKey,
        wallet: PublicKey,
        tokenAccounts: TokenAccount[],
        useSOLBalance?: boolean  // if has WSOL mint (default: true)
      },

      // priceLower: Decimal,
      // priceUpper: Decimal,

      tickLower: number,
      tickUpper: number,

      liquidity: BN,
      slippage: number
      associatedOnly?: boolean
    }): Promise<ReturnTypeMakeTransaction> {
    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];

    const signers: Signer[] = []

    // const tickLower = TickMath.getTickWithPriceAndTickspacing(
    //   priceLower,
    //   poolInfo.ammConfig.tickSpacing,
    //   poolInfo.mintA.decimals,
    //   poolInfo.mintB.decimals
    // );
    // const tickUpper = TickMath.getTickWithPriceAndTickspacing(
    //   priceUpper,
    //   poolInfo.ammConfig.tickSpacing,
    //   poolInfo.mintA.decimals,
    //   poolInfo.mintB.decimals
    // );

    const { amountSlippageA, amountSlippageB } =
      LiquidityMath.getAmountsFromLiquidityWithSlippage(
        poolInfo.sqrtPriceX64,
        SqrtPriceMath.getSqrtPriceX64FromTick(tickLower),
        SqrtPriceMath.getSqrtPriceX64FromTick(tickUpper),
        liquidity,
        true,
        true,
        slippage
      );

    const mintAUseSOLBalance = ownerInfo.useSOLBalance && poolInfo.mintA.mint.equals(Token.WSOL.mint)
    const mintBUseSOLBalance = ownerInfo.useSOLBalance && poolInfo.mintB.mint.equals(Token.WSOL.mint)
    const ownerTokenAccountA = await this._selectOrCreateTokenAccount({
      mint: poolInfo.mintA.mint,
      tokenAccounts: mintAUseSOLBalance ? [] : ownerInfo.tokenAccounts,
      owner: ownerInfo.wallet,

      createInfo: mintAUseSOLBalance ? {
        connection,
        payer: ownerInfo.feePayer,
        amount: amountSlippageA,

        frontInstructions,
        endInstructions,
        signers
      } : undefined,

      associatedOnly: mintAUseSOLBalance ? false : associatedOnly
    })

    const ownerTokenAccountB = await this._selectOrCreateTokenAccount({
      mint: poolInfo.mintB.mint,
      tokenAccounts: mintBUseSOLBalance ? [] : ownerInfo.tokenAccounts,
      owner: ownerInfo.wallet,

      createInfo: mintBUseSOLBalance ? {
        connection,
        payer: ownerInfo.feePayer,
        amount: amountSlippageB,

        frontInstructions,
        endInstructions,
        signers
      } : undefined,

      associatedOnly: mintBUseSOLBalance ? false : associatedOnly
    })

    logger.assertArgument(
      ownerTokenAccountA !== undefined && ownerTokenAccountB !== undefined,
      "cannot found target token accounts",
      "tokenAccounts",
      ownerInfo.tokenAccounts,
    );

    const transaction = new Transaction()
    transaction.add(addComputations())

    const insInfo = await this.makeOpenPositionInstructions({
      poolInfo,
      ownerInfo: {
        ...ownerInfo,
        tokenAccountA: ownerTokenAccountA!,
        tokenAccountB: ownerTokenAccountB!
      },
      tickLower,
      tickUpper,
      liquidity,
      amountSlippageA,
      amountSlippageB,
    })

    transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions)

    return {
      signers: [...signers, ...insInfo.signers],
      transaction,
      address: { ...insInfo.address }
    }
  }

  static async makeIncreaseLiquidityTransaction({
    connection, poolInfo, ownerPosition, ownerInfo, liquidity, slippage
  }: {
    connection: Connection
    poolInfo: AmmV3PoolInfo,
    ownerPosition: AmmV3PoolPersonalPosition,
    ownerInfo: {
      feePayer: PublicKey,
      wallet: PublicKey,
      tokenAccounts: TokenAccount[],
      useSOLBalance?: boolean  // if has WSOL mint
    },

    liquidity: BN,
    slippage: number
  }): Promise<ReturnTypeMakeTransaction> {
    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];

    const signers: Signer[] = []

    const { amountSlippageA, amountSlippageB } =
      LiquidityMath.getAmountsFromLiquidityWithSlippage(
        poolInfo.sqrtPriceX64,
        SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickLower),
        SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickUpper),
        liquidity,
        true,
        true,
        slippage
      );
    let ownerTokenAccountA: PublicKey | null
    let ownerTokenAccountB: PublicKey | null
    if (poolInfo.mintA.mint.equals(new PublicKey(WSOL.mint)) && ownerInfo.useSOLBalance) {
      // mintA
      ownerTokenAccountA = await this._handleTokenAccount({
        connection,
        side: "in",
        amount: amountSlippageA,
        mint: poolInfo.mintA.mint,
        tokenAccount: null,
        owner: ownerInfo.wallet,
        payer: ownerInfo.feePayer,
        frontInstructions,
        endInstructions,
        signers,
        bypassAssociatedCheck: true
      })
    } else {
      ownerTokenAccountA = await this._selectTokenAccount({
        tokenAccounts: ownerInfo.tokenAccounts,
        mint: poolInfo.mintA.mint,
        owner: ownerInfo.wallet,
        config: { associatedOnly: false },
      })
    }
    if (poolInfo.mintB.mint.equals(new PublicKey(WSOL.mint)) && ownerInfo.useSOLBalance) {
      // mintB
      ownerTokenAccountB = await this._handleTokenAccount({
        connection,
        side: "in",
        amount: amountSlippageB,
        mint: poolInfo.mintB.mint,
        tokenAccount: null,
        owner: ownerInfo.wallet,
        payer: ownerInfo.feePayer,
        frontInstructions,
        endInstructions,
        signers,
        bypassAssociatedCheck: true
      })
    } else {
      ownerTokenAccountB = await this._selectTokenAccount({
        tokenAccounts: ownerInfo.tokenAccounts,
        mint: poolInfo.mintB.mint,
        owner: ownerInfo.wallet,
        config: { associatedOnly: false },
      })
    }

    logger.assertArgument(
      !!ownerTokenAccountA || !!ownerTokenAccountB,
      "cannot found target token accounts",
      "tokenAccounts",
      ownerInfo.tokenAccounts,
    );

    const transaction = new Transaction()
    transaction.add(addComputations())

    const insInfo = await this.makeIncreaseLiquidityInstructions({
      poolInfo,
      ownerPosition,
      ownerInfo: {
        wallet: ownerInfo.wallet,
        tokenAccountA: ownerTokenAccountA!,
        tokenAccountB: ownerTokenAccountB!
      },
      liquidity,
      amountSlippageA,
      amountSlippageB
    })

    transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions)

    return {
      signers: [...signers, ...insInfo.signers],
      transaction,
      address: { ...insInfo.address }
    }
  }

  static async makeDecreaseLiquidityTransaction({
    connection, poolInfo, ownerPosition, ownerInfo, liquidity, slippage, associatedOnly = true
  }: {
    connection: Connection
    poolInfo: AmmV3PoolInfo,
    ownerPosition: AmmV3PoolPersonalPosition,
    ownerInfo: {
      feePayer: PublicKey,
      wallet: PublicKey,
      tokenAccounts: TokenAccount[],
      useSOLBalance?: boolean  // if has WSOL mint
      closePosition?: boolean
    },

    liquidity: BN,
    slippage: number
    associatedOnly?: boolean
  }): Promise<ReturnTypeMakeTransaction> {
    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];

    const signers: Signer[] = []

    const { amountSlippageA, amountSlippageB } =
      LiquidityMath.getAmountsFromLiquidityWithSlippage(
        poolInfo.sqrtPriceX64,
        SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickLower),
        SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickUpper),
        liquidity,
        false,
        true,
        slippage
      );

    const mintAUseSOLBalance = ownerInfo.useSOLBalance && poolInfo.mintA.mint.equals(Token.WSOL.mint)
    const mintBUseSOLBalance = ownerInfo.useSOLBalance && poolInfo.mintB.mint.equals(Token.WSOL.mint)

    const ownerTokenAccountA = await this._selectOrCreateTokenAccount({
      mint: poolInfo.mintA.mint,
      tokenAccounts: mintAUseSOLBalance ? [] : ownerInfo.tokenAccounts,
      owner: ownerInfo.wallet,

      createInfo: {
        connection,
        payer: ownerInfo.feePayer,
        amount: 0,

        frontInstructions,
        signers
      },

      associatedOnly: mintAUseSOLBalance ? false : associatedOnly
    })

    const ownerTokenAccountB = await this._selectOrCreateTokenAccount({
      mint: poolInfo.mintB.mint,
      tokenAccounts: mintBUseSOLBalance ? [] : ownerInfo.tokenAccounts,
      owner: ownerInfo.wallet,

      createInfo: {
        connection,
        payer: ownerInfo.feePayer,
        amount: 0,

        frontInstructions,
        signers
      },

      associatedOnly: mintBUseSOLBalance ? false : associatedOnly
    })

    const rewardAccounts: PublicKey[] = []
    for (const itemReward of poolInfo.rewardInfos) {
      const rewardUseSOLBalance = ownerInfo.useSOLBalance && itemReward.tokenMint.equals(Token.WSOL.mint)

      const ownerRewardAccount = await this._selectOrCreateTokenAccount({
        mint: itemReward.tokenMint,
        tokenAccounts: rewardUseSOLBalance ? [] : ownerInfo.tokenAccounts,
        owner: ownerInfo.wallet,
  
        createInfo: {
          connection,
          payer: ownerInfo.feePayer,
          amount: 0,
  
          frontInstructions,
          signers
        },
  
        associatedOnly: rewardUseSOLBalance ? false : associatedOnly
      })
      rewardAccounts.push(ownerRewardAccount!)
    }

    logger.assertArgument(
      !!ownerTokenAccountA || !!ownerTokenAccountB,
      "cannot found target token accounts",
      "tokenAccounts",
      ownerInfo.tokenAccounts,
    );

    const transaction = new Transaction()
    transaction.add(addComputations())

    const insInfo = await this.makeDecreaseLiquidityInstructions({
      poolInfo,
      ownerPosition,
      ownerInfo: {
        wallet: ownerInfo.wallet,
        tokenAccountA: ownerTokenAccountA!,
        tokenAccountB: ownerTokenAccountB!,
        rewardAccounts
      },
      liquidity,
      amountSlippageA,
      amountSlippageB
    })

    transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions)

    if (ownerInfo.closePosition) {
      transaction.add(...(await this.makeClosePositionInstructions({
        poolInfo, ownerInfo, ownerPosition
      })).instructions)
    }

    return {
      signers: [...signers, ...insInfo.signers],
      transaction,
      address: { ...insInfo.address }
    }
  }

  static async makeSwapBaseInTransaction({
    connection,
    poolInfo,
    ownerInfo,

    inputMint,
    amountIn,
    amountOutMin,
    priceLimit,

    remainingAccounts
  }: {
    connection: Connection
    poolInfo: AmmV3PoolInfo,
    ownerInfo: {
      feePayer: PublicKey,
      wallet: PublicKey,
      tokenAccounts: TokenAccount[],
      useSOLBalance?: boolean  // if has WSOL mint
    },

    inputMint: PublicKey,
    amountIn: BN,
    amountOutMin: BN,
    priceLimit?: Decimal

    remainingAccounts: PublicKey[]
  }): Promise<ReturnTypeMakeTransaction> {
    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];

    const signers: Signer[] = []

    let sqrtPriceLimitX64: BN;
    if (!priceLimit || priceLimit.equals(new Decimal(0))) {
      sqrtPriceLimitX64 = inputMint.equals(poolInfo.mintA.mint)
        ? MIN_SQRT_PRICE_X64.add(ONE)
        : MAX_SQRT_PRICE_X64.sub(ONE);
    } else {
      sqrtPriceLimitX64 = SqrtPriceMath.priceToSqrtPriceX64(
        priceLimit,
        poolInfo.mintA.decimals,
        poolInfo.mintB.decimals
      );
    }

    const isInputMintA = poolInfo.mintA.mint.equals(inputMint)

    let ownerTokenAccountA: PublicKey | null
    let ownerTokenAccountB: PublicKey | null
    if (poolInfo.mintA.mint.equals(new PublicKey(WSOL.mint)) && ownerInfo.useSOLBalance) {
      // mintA
      ownerTokenAccountA = await this._handleTokenAccount({
        connection,
        side: "in",
        amount: isInputMintA ? amountIn : 0,
        mint: poolInfo.mintA.mint,
        tokenAccount: null,
        owner: ownerInfo.wallet,
        payer: ownerInfo.feePayer,
        frontInstructions,
        endInstructions,
        signers,
        bypassAssociatedCheck: true
      })
    } else {
      ownerTokenAccountA = await this._selectTokenAccount({
        tokenAccounts: ownerInfo.tokenAccounts,
        mint: poolInfo.mintA.mint,
        owner: ownerInfo.wallet,
        config: { associatedOnly: false },
      })
    }
    if (poolInfo.mintB.mint.equals(new PublicKey(WSOL.mint)) && ownerInfo.useSOLBalance) {
      // mintB
      ownerTokenAccountB = await this._handleTokenAccount({
        connection,
        side: "in",
        amount: !isInputMintA ? amountIn : 0,
        mint: poolInfo.mintB.mint,
        tokenAccount: null,
        owner: ownerInfo.wallet,
        payer: ownerInfo.feePayer,
        frontInstructions,
        endInstructions,
        signers,
        bypassAssociatedCheck: true
      })
    } else {
      ownerTokenAccountB = await this._selectTokenAccount({
        tokenAccounts: ownerInfo.tokenAccounts,
        mint: poolInfo.mintB.mint,
        owner: ownerInfo.wallet,
        config: { associatedOnly: false },
      })
    }

    logger.assertArgument(
      !!ownerTokenAccountA || !!ownerTokenAccountB,
      "cannot found target token accounts",
      "tokenAccounts",
      ownerInfo.tokenAccounts,
    );

    const transaction = new Transaction()
    transaction.add(addComputations())

    const insInfo = await this.makeSwapBaseInInstructions({
      poolInfo,
      ownerInfo: {
        wallet: ownerInfo.wallet,
        tokenAccountA: ownerTokenAccountA!,
        tokenAccountB: ownerTokenAccountB!
      },

      inputMint,

      amountIn,
      amountOutMin,
      sqrtPriceLimitX64,

      remainingAccounts,
    })

    transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions)

    return {
      signers: [...signers, ...insInfo.signers],
      transaction,
      address: { ...insInfo.address }
    }
  }

  static async makeCLosePositionTransaction({
    poolInfo, ownerPosition, ownerInfo
  }: {
    poolInfo: AmmV3PoolInfo,
    ownerPosition: AmmV3PoolPersonalPosition,

    ownerInfo: {
      wallet: PublicKey,
    },
  }): Promise<ReturnTypeMakeTransaction> {
    const ins = await this.makeClosePositionInstructions({ poolInfo, ownerInfo, ownerPosition })
    const transaction = new Transaction()
    transaction.add(...ins.instructions)

    return {
      signers: ins.signers,
      transaction,
      address: { ...ins.address }
    }
  }

  static async makeInitRewardTransaction({
    connection,
    poolInfo,
    ownerInfo,
    rewardInfo
  }: {
    connection: Connection
    poolInfo: AmmV3PoolInfo,
    ownerInfo: {
      feePayer: PublicKey,
      wallet: PublicKey,
      tokenAccounts: TokenAccount[],
      useSOLBalance?: boolean  // if has WSOL mint
    },

    rewardInfo: {
      index: 1 | 2,
      mint: PublicKey,
      decimals: number,
      openTime: number,
      endTime: number,
      perSecond: BN,
    }
  }): Promise<ReturnTypeMakeTransaction> {
    logger.assertArgument(
      rewardInfo.endTime > rewardInfo.openTime,
      "reward time error",
      "rewardInfo",
      rewardInfo,
    );

    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];

    const signers: Signer[] = []

    let ownerRewardAccount: PublicKey | null
    if (ownerInfo.useSOLBalance) {
      ownerRewardAccount = await this._handleTokenAccount({
        connection,
        side: "in",
        amount: rewardInfo.perSecond.sub(new BN(rewardInfo.endTime - rewardInfo.openTime)),
        mint: rewardInfo.mint,
        tokenAccount: null,
        owner: ownerInfo.wallet,
        payer: ownerInfo.feePayer,
        frontInstructions,
        endInstructions,
        signers,
        bypassAssociatedCheck: true
      })
    } else {
      ownerRewardAccount = await this._selectTokenAccount({
        tokenAccounts: ownerInfo.tokenAccounts,
        mint: poolInfo.mintA.mint,
        owner: ownerInfo.wallet,
        config: { associatedOnly: false },
      })
    }

    logger.assertArgument(
      ownerRewardAccount,
      "no money",
      "ownerRewardAccount",
      ownerInfo.tokenAccounts,
    );

    const transaction = new Transaction()
    transaction.add(addComputations())

    const insInfo = this.makeInitRewardInstructions({
      poolInfo,
      ownerInfo: {
        wallet: ownerInfo.wallet,
        tokenAccount: ownerRewardAccount!
      },
      rewardInfo: {
        index: rewardInfo.index,
        mint: rewardInfo.mint,
        vault: (await getPdaPoolRewardVaulId(poolInfo.programId, poolInfo.id, rewardInfo.mint)).publicKey,
        openTime: rewardInfo.openTime,
        endTime: rewardInfo.endTime,
        emissionsPerSecondX64: MathUtil.decimalToX64(new Decimal(rewardInfo.perSecond.toNumber() / 10 ** rewardInfo.decimals))
      }
    })

    transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions)

    return {
      signers: [...signers, ...insInfo.signers],
      transaction,
      address: { ...insInfo.address }
    }
  }

  static async makeSetRewardTransaction({
    connection,
    poolInfo,
    ownerInfo,
    rewardInfo
  }: {
    connection: Connection
    poolInfo: AmmV3PoolInfo,
    ownerInfo: {
      feePayer: PublicKey,
      wallet: PublicKey,
      tokenAccounts: TokenAccount[],
      useSOLBalance?: boolean  // if has WSOL mint
    },

    rewardInfo: {
      index: 1 | 2,
      mint: PublicKey,
      decimals: number,
      openTime: number,
      endTime: number,
      perSecond: BN,
    }
  }): Promise<ReturnTypeMakeTransaction> {
    logger.assertArgument(
      rewardInfo.endTime > rewardInfo.openTime,
      "reward time error",
      "rewardInfo",
      rewardInfo,
    );

    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];

    const signers: Signer[] = []

    let ownerRewardAccount: PublicKey | null
    if (ownerInfo.useSOLBalance) {
      ownerRewardAccount = await this._handleTokenAccount({
        connection,
        side: "in",
        amount: rewardInfo.perSecond.sub(new BN(rewardInfo.endTime - rewardInfo.openTime)),
        mint: rewardInfo.mint,
        tokenAccount: null,
        owner: ownerInfo.wallet,
        payer: ownerInfo.feePayer,
        frontInstructions,
        endInstructions,
        signers,
        bypassAssociatedCheck: true
      })
    } else {
      ownerRewardAccount = await this._selectTokenAccount({
        tokenAccounts: ownerInfo.tokenAccounts,
        mint: poolInfo.mintA.mint,
        owner: ownerInfo.wallet,
        config: { associatedOnly: false },
      })
    }

    logger.assertArgument(
      ownerRewardAccount,
      "no money",
      "ownerRewardAccount",
      ownerInfo.tokenAccounts,
    );

    const transaction = new Transaction()
    transaction.add(addComputations())

    const insInfo = this.makeSetRewardInstructions({
      poolInfo,
      ownerInfo: {
        wallet: ownerInfo.wallet,
        tokenAccount: ownerRewardAccount!
      },
      rewardInfo: {
        index: rewardInfo.index,
        vault: (await getPdaPoolRewardVaulId(poolInfo.programId, poolInfo.id, rewardInfo.mint)).publicKey,
        openTime: rewardInfo.openTime,
        endTime: rewardInfo.endTime,
        emissionsPerSecondX64: MathUtil.decimalToX64(new Decimal(rewardInfo.perSecond.toNumber() / 10 ** rewardInfo.decimals))
      }
    })

    transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions)

    return {
      signers: [...signers, ...insInfo.signers],
      transaction,
      address: { ...insInfo.address }
    }
  }

  static async makeCollectRewardTransaction({
    connection,
    poolInfo,
    ownerInfo,
    rewardInfo
  }: {
    connection: Connection
    poolInfo: AmmV3PoolInfo,
    ownerInfo: {
      feePayer: PublicKey,
      wallet: PublicKey,
      tokenAccounts: TokenAccount[],
      useSOLBalance?: boolean  // if has WSOL mint
    },

    rewardInfo: {
      index: 1 | 2,
      mint: PublicKey,
      decimals: number,
      openTime: number,
      endTime: number,
      perSecond: BN,
    }
  }): Promise<ReturnTypeMakeTransaction> {
    logger.assertArgument(
      rewardInfo.endTime > rewardInfo.openTime,
      "reward time error",
      "rewardInfo",
      rewardInfo,
    );

    const frontInstructions: TransactionInstruction[] = [];
    const endInstructions: TransactionInstruction[] = [];

    const signers: Signer[] = []

    let ownerRewardAccount: PublicKey | null
    if (ownerInfo.useSOLBalance) {
      ownerRewardAccount = await this._handleTokenAccount({
        connection,
        side: "in",
        amount: 0,
        mint: rewardInfo.mint,
        tokenAccount: null,
        owner: ownerInfo.wallet,
        payer: ownerInfo.feePayer,
        frontInstructions,
        endInstructions,
        signers,
        bypassAssociatedCheck: true
      })
    } else {
      ownerRewardAccount = await this._selectTokenAccount({
        tokenAccounts: ownerInfo.tokenAccounts,
        mint: poolInfo.mintA.mint,
        owner: ownerInfo.wallet,
        config: { associatedOnly: false },
      })
    }

    logger.assertArgument(
      ownerRewardAccount,
      "no money",
      "ownerRewardAccount",
      ownerInfo.tokenAccounts,
    );

    const transaction = new Transaction()
    transaction.add(addComputations())

    const insInfo = this.makeCollectRewardInstructions({
      poolInfo,
      ownerInfo: {
        wallet: ownerInfo.wallet,
        tokenAccount: ownerRewardAccount!
      },
      rewardInfo: {
        index: rewardInfo.index,
        vault: (await getPdaPoolRewardVaulId(poolInfo.programId, poolInfo.id, rewardInfo.mint)).publicKey,
      }
    })

    transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions)

    return {
      signers: [...signers, ...insInfo.signers],
      transaction,
      address: { ...insInfo.address }
    }
  }

  // static async makeHarvestAllRewardTransaction({
  //   connection, fetchInfo, ownerInfo
  // }: {
  //   connection: Connection
  //   fetchInfo: ReturnTypeFetchMultiplePoolInfos,
  //   ownerInfo: {
  //     feePayer: PublicKey,
  //     wallet: PublicKey,
  //     tokenAccounts: TokenAccount[],
  //     useSOLBalance?: boolean  // if has WSOL mint
  //   },
  // }){
    
  // }

  // instrument
  static async makeCreatePoolInstructions({
    connection,
    programId,
    owner,
    mintA,
    mintB,
    ammConfigId,
    initialPriceX64
  }: {
    connection: Connection,
    programId: PublicKey,
    owner: PublicKey,
    mintA: MintInfo,
    mintB: MintInfo,
    ammConfigId: PublicKey,
    initialPriceX64: BN
  }): Promise<ReturnTypeMakeInstructions> {
    const observationId = new Keypair();
    const ins = [
      SystemProgram.createAccount({
        fromPubkey: owner,
        newAccountPubkey: observationId.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(ObservationInfoLayout.span),
        space: ObservationInfoLayout.span,
        programId,
      }),
    ];

    const poolId = await (await getPdaPoolId(programId, ammConfigId, mintA.mint, mintB.mint)).publicKey;
    const mintAVault = await (await getPdaPoolVaultId(programId, poolId, mintA.mint)).publicKey;
    const mintBVault = await (await getPdaPoolVaultId(programId, poolId, mintB.mint)).publicKey;

    ins.push(
      createPoolInstruction(
        programId,
        poolId,
        owner,
        ammConfigId,
        observationId.publicKey,
        mintA.mint,
        mintAVault,
        mintB.mint,
        mintBVault,
        initialPriceX64
      )
    );

    return {
      signers: [observationId],
      instructions: ins,
      address: { poolId, observationId: observationId.publicKey, mintAVault, mintBVault },
    };
  }

  static async makeOpenPositionInstructions(
    { poolInfo, ownerInfo, tickLower, tickUpper, liquidity, amountSlippageA, amountSlippageB }: {
      poolInfo: AmmV3PoolInfo,

      ownerInfo: {
        feePayer: PublicKey,
        wallet: PublicKey,
        tokenAccountA: PublicKey
        tokenAccountB: PublicKey
      },

      tickLower: number,
      tickUpper: number,
      liquidity: BN,
      amountSlippageA: BN,
      amountSlippageB: BN,
    }
  ): Promise<ReturnTypeMakeInstructions> {
    const signers: Signer[] = []

    const nftMintAKeypair = new Keypair();
    signers.push(nftMintAKeypair)

    const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(tickLower, poolInfo.ammConfig.tickSpacing);
    const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(tickUpper, poolInfo.ammConfig.tickSpacing);

    const { publicKey: tickArrayLower } = await getPdaTickArrayAddress(poolInfo.programId, poolInfo.id, tickArrayLowerStartIndex);
    const { publicKey: tickArrayUpper } = await getPdaTickArrayAddress(poolInfo.programId, poolInfo.id, tickArrayUpperStartIndex);

    const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, nftMintAKeypair.publicKey);
    const { publicKey: metadataAccount } = await getPdaMetadataKey(nftMintAKeypair.publicKey);
    const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(poolInfo.programId, nftMintAKeypair.publicKey)
    const { publicKey: protocolPosition } = await getPdaProtocolPositionAddress(poolInfo.programId, poolInfo.id, tickLower, tickUpper)

    const ins = openPositionInstruction(
      poolInfo.programId,
      ownerInfo.feePayer,
      poolInfo.id,
      ownerInfo.wallet,
      nftMintAKeypair.publicKey,
      positionNftAccount,
      metadataAccount,
      protocolPosition,
      tickArrayLower,
      tickArrayUpper,
      personalPosition,
      ownerInfo.tokenAccountA,
      ownerInfo.tokenAccountB,
      poolInfo.mintA.vault,
      poolInfo.mintB.vault,

      tickLower,
      tickUpper,
      tickArrayLowerStartIndex,
      tickArrayUpperStartIndex,
      liquidity,
      amountSlippageA,
      amountSlippageB
    )

    return {
      signers: [nftMintAKeypair],
      instructions: [ins],
      address: {},
    };
  }

  static async makeIncreaseLiquidityInstructions({
    poolInfo,
    ownerPosition,
    ownerInfo,
    liquidity,
    amountSlippageA,
    amountSlippageB
  }: {
    poolInfo: AmmV3PoolInfo,
    ownerPosition: AmmV3PoolPersonalPosition,

    ownerInfo: {
      wallet: PublicKey,
      tokenAccountA: PublicKey
      tokenAccountB: PublicKey
    },

    liquidity: BN,
    amountSlippageA: BN,
    amountSlippageB: BN
  }): Promise<ReturnTypeMakeInstructions> {
    const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(ownerPosition.tickLower, poolInfo.ammConfig.tickSpacing);
    const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(ownerPosition.tickUpper, poolInfo.ammConfig.tickSpacing);

    const { publicKey: tickArrayLower } = await getPdaTickArrayAddress(poolInfo.programId, poolInfo.id, tickArrayLowerStartIndex);
    const { publicKey: tickArrayUpper } = await getPdaTickArrayAddress(poolInfo.programId, poolInfo.id, tickArrayUpperStartIndex);

    const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, ownerPosition.nftMint);

    const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(poolInfo.programId, ownerPosition.nftMint);
    const { publicKey: protocolPosition } = await getPdaProtocolPositionAddress(poolInfo.programId, poolInfo.id, ownerPosition.tickLower, ownerPosition.tickUpper);

    const ins: TransactionInstruction[] = [];
    ins.push(
      increaseLiquidityInstruction(
        poolInfo.programId,
        ownerInfo.wallet,
        positionNftAccount,
        personalPosition,
        poolInfo.id,
        protocolPosition,
        tickArrayLower,
        tickArrayUpper,
        ownerInfo.tokenAccountA,
        ownerInfo.tokenAccountB,
        poolInfo.mintA.vault,
        poolInfo.mintB.vault,

        liquidity,
        amountSlippageA,
        amountSlippageB
      )
    );

    return {
      signers: [],
      instructions: ins,
      address: {},
    };
  }

  static async makeDecreaseLiquidityInstructions({
    poolInfo,
    ownerPosition,
    ownerInfo,
    liquidity,
    amountSlippageA,
    amountSlippageB
  }: {

    poolInfo: AmmV3PoolInfo,
    ownerPosition: AmmV3PoolPersonalPosition,

    ownerInfo: {
      wallet: PublicKey,
      tokenAccountA: PublicKey
      tokenAccountB: PublicKey
      rewardAccounts: PublicKey[]
    },

    liquidity: BN,
    amountSlippageA: BN,
    amountSlippageB: BN

  }): Promise<ReturnTypeMakeInstructions> {
    const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(ownerPosition.tickLower, poolInfo.ammConfig.tickSpacing);
    const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(ownerPosition.tickUpper, poolInfo.ammConfig.tickSpacing);

    const { publicKey: tickArrayLower } = await getPdaTickArrayAddress(poolInfo.programId, poolInfo.id, tickArrayLowerStartIndex);
    const { publicKey: tickArrayUpper } = await getPdaTickArrayAddress(poolInfo.programId, poolInfo.id, tickArrayUpperStartIndex);
    const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, ownerPosition.nftMint);

    const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(poolInfo.programId, ownerPosition.nftMint);
    const { publicKey: protocolPosition } = await getPdaProtocolPositionAddress(poolInfo.programId, poolInfo.id, ownerPosition.tickLower, ownerPosition.tickUpper);

    const rewardAccounts: {
      poolRewardVault: PublicKey,
      ownerRewardVault: PublicKey
    }[] = []
    for (let i = 0; i < poolInfo.rewardInfos.length; i++) {
      rewardAccounts.push({
        poolRewardVault: poolInfo.rewardInfos[0].tokenVault,
        ownerRewardVault: ownerInfo.rewardAccounts[0]
      })
    }

    const ins: TransactionInstruction[] = [];
    ins.push(
      decreaseLiquidityInstruction(
        poolInfo.programId,
        ownerInfo.wallet,
        positionNftAccount,
        personalPosition,
        poolInfo.id,
        protocolPosition,
        tickArrayLower,
        tickArrayUpper,
        ownerInfo.tokenAccountA,
        ownerInfo.tokenAccountB,
        poolInfo.mintA.vault,
        poolInfo.mintB.vault,
        rewardAccounts,

        liquidity,
        amountSlippageA,
        amountSlippageB
      )
    );

    return {
      signers: [],
      instructions: ins,
      address: {},
    };
  }

  static async makeClosePositionInstructions({
    poolInfo, ownerInfo, ownerPosition
  }: {
    poolInfo: AmmV3PoolInfo,
    ownerPosition: AmmV3PoolPersonalPosition,

    ownerInfo: {
      wallet: PublicKey,
    },
  }): Promise<ReturnTypeMakeInstructions> {
    const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, ownerPosition.nftMint);
    const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(poolInfo.programId, ownerPosition.nftMint)

    const ins: TransactionInstruction[] = [];
    ins.push(
      closePositionInstruction(
        poolInfo.programId,

        ownerInfo.wallet,
        ownerPosition.nftMint,
        positionNftAccount,
        personalPosition
      )
    );

    return {
      signers: [],
      instructions: ins,
      address: {},
    };
  }

  static makeSwapBaseInInstructions({ poolInfo, ownerInfo, inputMint, amountIn, amountOutMin, sqrtPriceLimitX64, remainingAccounts }: {
    poolInfo: AmmV3PoolInfo,

    ownerInfo: {
      wallet: PublicKey,
      tokenAccountA: PublicKey
      tokenAccountB: PublicKey
    },

    inputMint: PublicKey

    amountIn: BN
    amountOutMin: BN
    sqrtPriceLimitX64: BN

    remainingAccounts: PublicKey[]
  }): ReturnTypeMakeInstructions {
    const isInputMintA = poolInfo.mintA.mint.equals(inputMint)
    const ins = [
      swapInstruction(
        poolInfo.programId,
        ownerInfo.wallet,

        poolInfo.id,
        poolInfo.ammConfig.id,

        isInputMintA ? ownerInfo.tokenAccountA : ownerInfo.tokenAccountB,
        isInputMintA ? ownerInfo.tokenAccountB : ownerInfo.tokenAccountA,

        isInputMintA ? poolInfo.mintA.vault : poolInfo.mintB.vault,
        isInputMintA ? poolInfo.mintB.vault : poolInfo.mintA.vault,

        remainingAccounts,
        poolInfo.observationId,
        amountIn,
        amountOutMin,
        sqrtPriceLimitX64,
        true
      ),
    ];
    return {
      signers: [],
      instructions: ins,
      address: {},
    };
  }

  static makeInitRewardInstructions({
    poolInfo, ownerInfo, rewardInfo
  }: {
    poolInfo: AmmV3PoolInfo,
    ownerInfo: {
      wallet: PublicKey,
      tokenAccount: PublicKey,
    },
    rewardInfo: {
      index: number,
      mint: PublicKey,
      vault: PublicKey,
      openTime: number,
      endTime: number,
      emissionsPerSecondX64: BN
    }
  }): ReturnTypeMakeInstructions {
    const ins = [
      initRewardInstruction(
        poolInfo.programId,
        ownerInfo.wallet,
        poolInfo.id,
        poolInfo.ammConfig.id,

        ownerInfo.tokenAccount,
        rewardInfo.mint,
        rewardInfo.vault,

        rewardInfo.index,
        rewardInfo.openTime,
        rewardInfo.endTime,
        rewardInfo.emissionsPerSecondX64
      ),
    ];
    return {
      signers: [],
      instructions: ins,
      address: {},
    };
  }

  static makeSetRewardInstructions({
    poolInfo, ownerInfo, rewardInfo
  }: {
    poolInfo: AmmV3PoolInfo,
    ownerInfo: {
      wallet: PublicKey,
      tokenAccount: PublicKey,
    },
    rewardInfo: {
      index: number,
      vault: PublicKey,
      openTime: number,
      endTime: number,
      emissionsPerSecondX64: BN
    }
  }): ReturnTypeMakeInstructions {
    const ins = [
      setRewardInstruction(
        poolInfo.programId,
        ownerInfo.wallet,
        poolInfo.id,
        poolInfo.ammConfig.id,

        ownerInfo.tokenAccount,
        rewardInfo.vault,

        rewardInfo.index,
        rewardInfo.openTime,
        rewardInfo.endTime,
        rewardInfo.emissionsPerSecondX64
      ),
    ];
    return {
      signers: [],
      instructions: ins,
      address: {},
    };
  }

  static makeCollectRewardInstructions({
    poolInfo, ownerInfo, rewardInfo
  }: {
    poolInfo: AmmV3PoolInfo,
    ownerInfo: {
      wallet: PublicKey,
      tokenAccount: PublicKey,
    },
    rewardInfo: {
      index: number,
      vault: PublicKey,
    }
  }): ReturnTypeMakeInstructions {
    const ins = [
      collectRewardInstruction(
        poolInfo.programId,
        ownerInfo.wallet,
        poolInfo.id,

        ownerInfo.tokenAccount,
        rewardInfo.vault,

        rewardInfo.index,
      ),
    ];
    return {
      signers: [],
      instructions: ins,
      address: {},
    };
  }

  // calculate
  static getLiquidityAmountOutFromAmountIn({ poolInfo, inputA, tickLower, tickUpper, amount, slippage, add }:
    { poolInfo: AmmV3PoolInfo, inputA: boolean, tickLower: number, tickUpper: number, amount: BN, slippage: number, add: boolean }): ReturnTypeGetLiquidityAmountOutFromAmountIn {
    const sqrtPriceX64 = poolInfo.sqrtPriceX64
    const sqrtPriceX64A = SqrtPriceMath.getSqrtPriceX64FromTick(tickLower)
    const sqrtPriceX64B = SqrtPriceMath.getSqrtPriceX64FromTick(tickUpper)

    const coefficient = add ? 1 - slippage : 1 + slippage;
    const _amount = amount.mul(new BN(Math.floor(coefficient * 1000000))).div(new BN(1000000))

    let liquidity: BN
    if (sqrtPriceX64.lte(sqrtPriceX64A)) {
      liquidity = inputA ? LiquidityMath.getLiquidityFromTokenAmountA(sqrtPriceX64A, sqrtPriceX64B, _amount, !add) : new BN(0)
    } else if (sqrtPriceX64.lte(sqrtPriceX64B)) {
      const liquidity0 = LiquidityMath.getLiquidityFromTokenAmountA(sqrtPriceX64, sqrtPriceX64B, _amount, !add);
      const liquidity1 = LiquidityMath.getLiquidityFromTokenAmountB(sqrtPriceX64A, sqrtPriceX64, _amount);
      liquidity = inputA ? liquidity0 : liquidity1
    } else {
      liquidity = inputA ? new BN(0) : LiquidityMath.getLiquidityFromTokenAmountB(sqrtPriceX64A, sqrtPriceX64B, _amount);
    }

    const amountsSlippage = LiquidityMath.getAmountsFromLiquidityWithSlippage(poolInfo.sqrtPriceX64, sqrtPriceX64A, sqrtPriceX64B, liquidity, add, !add, slippage)
    const amounts = LiquidityMath.getAmountsFromLiquidity(poolInfo.sqrtPriceX64, sqrtPriceX64A, sqrtPriceX64B, liquidity, !add)

    return { liquidity, ...amountsSlippage, ...amounts }
  }

  static getAmountsFromLiquidity({ poolInfo, ownerPosition, liquidity, slippage, add }: {
    poolInfo: AmmV3PoolInfo,
    ownerPosition: AmmV3PoolPersonalPosition,
    liquidity: BN
    slippage: number,
    add: boolean
  }): ReturnTypeGetAmountsFromLiquidity {
    const sqrtPriceX64A = SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickLower)
    const sqrtPriceX64B = SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickUpper)
    return LiquidityMath.getAmountsFromLiquidityWithSlippage(poolInfo.sqrtPriceX64, sqrtPriceX64A, sqrtPriceX64B, liquidity, add, add, slippage)
  }

  static getPriceAndTick({ poolInfo, price, baseIn }: { poolInfo: AmmV3PoolInfo, price: Decimal, baseIn: boolean }): ReturnTypeGetPriceAndTick {
    const _price = baseIn ? price : new Decimal(1).div(price)

    const tick = TickMath.getTickWithPriceAndTickspacing(_price, poolInfo.ammConfig.tickSpacing, poolInfo.mintA.decimals, poolInfo.mintB.decimals)
    const tickSqrtPriceX64 = SqrtPriceMath.getSqrtPriceX64FromTick(tick)
    const tickPrice = SqrtPriceMath.sqrtPriceX64ToPrice(tickSqrtPriceX64, poolInfo.mintA.decimals, poolInfo.mintB.decimals)

    return baseIn ? { tick, price: tickPrice } : { tick, price: new Decimal(1).div(tickPrice) }
  }

  static getTickPrice({ poolInfo, tick, baseIn }: { poolInfo: AmmV3PoolInfo, tick: number, baseIn: boolean }): ReturnTypeGetTickPrice {
    const tickSqrtPriceX64 = SqrtPriceMath.getSqrtPriceX64FromTick(tick)
    const tickPrice = SqrtPriceMath.sqrtPriceX64ToPrice(tickSqrtPriceX64, poolInfo.mintA.decimals, poolInfo.mintB.decimals)

    return baseIn ? { tick, price: tickPrice, tickSqrtPriceX64 } : { tick, price: new Decimal(1).div(tickPrice), tickSqrtPriceX64 }
  }

  static async computeAmountOutFormat({ poolInfo, tickArrayCache, amountIn, currencyOut, slippage }: {
    poolInfo: AmmV3PoolInfo,
    tickArrayCache: { [key: string]: TickArray; },

    amountIn: CurrencyAmount | TokenAmount,
    currencyOut: Token | Currency,
    slippage: Percent
  }): Promise<ReturnTypeComputeAmountOutFormat> {
    const amountInIsTokenAmount = amountIn instanceof TokenAmount
    const inputMint = (amountInIsTokenAmount ? amountIn.token : Token.WSOL).mint;
    const _amountIn = amountIn.raw
    const _slippage = slippage.numerator.toNumber() / slippage.denominator.toNumber()

    const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee, remainingAccounts } = await AmmV3.computeAmountOut({
      poolInfo,
      tickArrayCache,
      baseMint: inputMint,
      amountIn: _amountIn,
      slippage: _slippage,
    })

    const _amountOut = currencyOut instanceof Token ? new TokenAmount(currencyOut, amountOut) : new CurrencyAmount(currencyOut, amountOut)
    const _minAmountOut = currencyOut instanceof Token ? new TokenAmount(currencyOut, minAmountOut) : new CurrencyAmount(currencyOut, minAmountOut)
    const _currentPrice = new Price(
      amountInIsTokenAmount ? amountIn.token : amountIn.currency,
      new BN(10).pow(new BN(20 + (amountInIsTokenAmount ? amountIn.token : amountIn.currency).decimals)),
      currencyOut instanceof Token ? currencyOut : Token.WSOL,
      currentPrice.mul(new Decimal(10 ** (20 + (currencyOut instanceof Token ? currencyOut : Token.WSOL).decimals))).toFixed(0)
    )
    const _executionPrice = new Price(
      amountInIsTokenAmount ? amountIn.token : amountIn.currency,
      new BN(10).pow(new BN(20 + (amountInIsTokenAmount ? amountIn.token : amountIn.currency).decimals)),
      currencyOut instanceof Token ? currencyOut : Token.WSOL,
      executionPrice.mul(new Decimal(10 ** (20 + (currencyOut instanceof Token ? currencyOut : Token.WSOL).decimals))).toFixed(0)
    )
    const _fee = amountInIsTokenAmount ? new TokenAmount(amountIn.token, fee) : new CurrencyAmount(amountIn.currency, fee);

    return {
      amountOut: _amountOut,
      minAmountOut: _minAmountOut,
      currentPrice: _currentPrice,
      executionPrice: _executionPrice,
      priceImpact,
      fee: _fee,
      remainingAccounts
    }
  }

  static async computeAmountOut(
    { poolInfo, tickArrayCache, baseMint, amountIn, slippage, priceLimit = new Decimal(0) }: {
      poolInfo: AmmV3PoolInfo,
      tickArrayCache: { [key: string]: TickArray; },
      baseMint: PublicKey,

      amountIn: BN,
      slippage: number,
      priceLimit?: Decimal
    }
  ): Promise<ReturnTypeComputeAmountOut> {
    let sqrtPriceLimitX64: BN;
    if (priceLimit.equals(new Decimal(0))) {
      sqrtPriceLimitX64 = baseMint.equals(poolInfo.mintA.mint)
        ? MIN_SQRT_PRICE_X64.add(ONE)
        : MAX_SQRT_PRICE_X64.sub(ONE);
    } else {
      sqrtPriceLimitX64 = SqrtPriceMath.priceToSqrtPriceX64(
        priceLimit,
        poolInfo.mintA.decimals,
        poolInfo.mintB.decimals
      );
    }

    const { expectedAmountOut, remainingAccounts, executionPrice: _executionPriceX64, feeAmount } = await PoolUtils.getOutputAmountAndRemainAccounts(
      poolInfo,
      tickArrayCache,
      baseMint,
      amountIn,
      sqrtPriceLimitX64
    );

    const _executionPrice = SqrtPriceMath.sqrtPriceX64ToPrice(_executionPriceX64, poolInfo.mintA.decimals, poolInfo.mintB.decimals)
    const executionPrice = baseMint.equals(poolInfo.mintA.mint) ? _executionPrice : new Decimal(1).div(_executionPrice)

    const minAmountOut = expectedAmountOut.mul(new BN(Math.floor((1 - slippage) * 10000000000))).div(new BN(10000000000));

    const poolPrice = poolInfo.mintA.mint.equals(baseMint) ? poolInfo.currentPrice : new Decimal(1).div(poolInfo.currentPrice)
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

      remainingAccounts
    }
  }

  // static estimateAprsForPriceRangeOrca({ poolInfo, aprType, mintPrice, positionTickLowerIndex, positionTickUpperIndex, rewardMintDecimals, chainTime }: {
  //   poolInfo: AmmV3PoolInfo,
  //   aprType: 'day' | 'week' | 'month',

  //   mintPrice: { [mint: string]: Price }

  //   positionTickLowerIndex: number,
  //   positionTickUpperIndex: number,

  //   chainTime: number

  //   rewardMintDecimals: { [mint: string]: number }
  // }) {
  //   const aprTypeDay = aprType === 'day' ? 1 : aprType === 'week' ? 7 : aprType === 'month' ? 30 : 0
  //   const aprInfo = poolInfo[aprType]
  //   const mintPriceA = mintPrice[poolInfo.mintA.mint.toString()]
  //   const mintPriceB = mintPrice[poolInfo.mintB.mint.toString()]

  //   if (!aprInfo || !mintPriceA || !mintPriceB || positionTickLowerIndex >= positionTickUpperIndex) return { feeApr: 0, rewardsApr: [0, 0, 0], apr: 0 }

  //   const sqrtPriceX64A = SqrtPriceMath.getSqrtPriceX64FromTick(positionTickLowerIndex)
  //   const sqrtPriceX64B = SqrtPriceMath.getSqrtPriceX64FromTick(positionTickUpperIndex)

  //   const { amountSlippageA, amountSlippageB } = LiquidityMath.getAmountsFromLiquidityWithSlippage(poolInfo.sqrtPriceX64, sqrtPriceX64A, sqrtPriceX64B, poolInfo.liquidity, false, false, 0)


  //   const tokenValueA = new Decimal(amountSlippageA.toString()).div(new Decimal(10).pow(poolInfo.mintA.decimals)).mul(new Decimal(mintPriceA.toFixed(poolInfo.mintA.decimals)))
  //   const tokenValueB = new Decimal(amountSlippageB.toString()).div(new Decimal(10).pow(poolInfo.mintB.decimals)).mul(new Decimal(mintPriceB.toFixed(poolInfo.mintB.decimals)))

  //   const concentratedValue = tokenValueA.add(tokenValueB);

  //   const feesPerYear = new Decimal(aprInfo.volumeFee).mul(365).div(aprTypeDay);
  //   const feeApr = feesPerYear.div(concentratedValue).mul(100).toNumber();

  //   const SECONDS_PER_YEAR = 3600 * 24 * 365

  //   const rewardsApr = poolInfo.rewardInfos.map((i) => {
  //     const iDecimal = rewardMintDecimals[i.tokenMint.toString()]
  //     const iPrice = mintPrice[i.tokenMint.toString()]

  //     if (chainTime < i.openTime.toNumber() || chainTime > i.endTime.toNumber() || i.perSecond.equals(0) || !iPrice || iDecimal === undefined) return 0

  //     return new Decimal(iPrice.toFixed(iDecimal)).mul(i.perSecond.mul(SECONDS_PER_YEAR)).div(new Decimal(10).pow(iDecimal)).div(concentratedValue).mul(100).toNumber()
  //   })

  //   return {
  //     feeApr,
  //     rewardsApr,
  //     apr: feeApr + rewardsApr.reduce((a, b) => a + b, 0)
  //   }
  // }

  static estimateAprsForPriceRangeMultiplier({ poolInfo, aprType, positionTickLowerIndex, positionTickUpperIndex }: {
    poolInfo: AmmV3PoolInfo,
    aprType: 'day' | 'week' | 'month',

    positionTickLowerIndex: number,
    positionTickUpperIndex: number,
  }) {
    const aprInfo = poolInfo[aprType]

    const priceLower = this.getTickPrice({ poolInfo, tick: positionTickLowerIndex, baseIn: true }).price.toNumber()
    const priceUpper = this.getTickPrice({ poolInfo, tick: positionTickUpperIndex, baseIn: true }).price.toNumber()

    const _minPrice = Math.max(priceLower, aprInfo.priceMin)
    const _maxPrice = Math.min(priceUpper, aprInfo.priceMax)

    const sub = _maxPrice - _minPrice

    const userRange = priceUpper - priceLower
    const tradeRange = aprInfo.priceMax - aprInfo.priceMin

    let p

    if (sub <= 0) p = 0
    else if (userRange === sub) p = (tradeRange) / sub
    else if (tradeRange === sub) p = sub / ( userRange)
    else p = sub / (tradeRange) * (sub /(userRange))

    return {
      feeApr: aprInfo.feeApr * p,
      rewardsApr: [aprInfo.rewardApr.A * p, aprInfo.rewardApr.B * p, aprInfo.rewardApr.C * p],
      apr: aprInfo.apr * p
    }
  }

  static estimateAprsForPriceRangeDelta({ poolInfo, aprType, mintPrice, rewardMintDecimals, liquidity, positionTickLowerIndex, positionTickUpperIndex, chainTime}: {
    poolInfo: AmmV3PoolInfo,
    aprType: 'day' | 'week' | 'month',

    mintPrice: { [mint: string]: Price },

    rewardMintDecimals: { [mint: string]: number },

    liquidity: BN,
    positionTickLowerIndex: number,
    positionTickUpperIndex: number,

    chainTime: number,
  }) {
    const aprTypeDay = aprType === 'day' ? 1 : aprType === 'week' ? 7 : aprType === 'month' ? 30 : 0
    const aprInfo = poolInfo[aprType]
    const mintPriceA = mintPrice[poolInfo.mintA.mint.toString()]
    const mintPriceB = mintPrice[poolInfo.mintB.mint.toString()]
    const mintDecimalsA = poolInfo.mintA.decimals
    const mintDecimalsB = poolInfo.mintB.decimals

    if (!aprInfo || !mintPriceA || !mintPriceB) return { feeApr: 0, rewardsApr: [0, 0, 0], apr: 0 }

    const sqrtPriceX64A = SqrtPriceMath.getSqrtPriceX64FromTick(positionTickLowerIndex)
    const sqrtPriceX64B = SqrtPriceMath.getSqrtPriceX64FromTick(positionTickUpperIndex)

    const { amountSlippageA: poolLiquidityA, amountSlippageB: poolLiquidityB } = LiquidityMath.getAmountsFromLiquidityWithSlippage(poolInfo.sqrtPriceX64, sqrtPriceX64A, sqrtPriceX64B, poolInfo.liquidity, false, false, 0)
    const { amountSlippageA: userLiquidityA, amountSlippageB: userLiquidityB } = LiquidityMath.getAmountsFromLiquidityWithSlippage(poolInfo.sqrtPriceX64, sqrtPriceX64A, sqrtPriceX64B, liquidity, false, false, 0)

    const poolTvl = new Decimal(poolLiquidityA.toString()).div(new Decimal(10).pow(mintDecimalsA)).mul(mintPriceA.toFixed(mintDecimalsA)).add(new Decimal(poolLiquidityB.toString()).div(new Decimal(10).pow(mintDecimalsB)).mul(mintPriceB.toFixed(mintDecimalsB)))
    const userTvl = new Decimal(userLiquidityA.toString()).div(new Decimal(10).pow(mintDecimalsA)).mul(mintPriceA.toFixed(mintDecimalsA)).add(new Decimal(userLiquidityB.toString()).div(new Decimal(10).pow(mintDecimalsB)).mul(mintPriceB.toFixed(mintDecimalsB)))

    const p = userTvl.div(poolTvl.add(userTvl)).div(userTvl)

    const feesPerYear = new Decimal(aprInfo.volumeFee).mul(365).div(aprTypeDay);
    const feeApr = feesPerYear.mul(p).mul(100).toNumber();

    const SECONDS_PER_YEAR = 3600 * 24 * 365

    const rewardsApr = poolInfo.rewardInfos.map((i) => {
      const iDecimal = rewardMintDecimals[i.tokenMint.toString()]
      const iPrice = mintPrice[i.tokenMint.toString()]

      if (chainTime < i.openTime.toNumber() || chainTime > i.endTime.toNumber() || i.perSecond.equals(0) || !iPrice || iDecimal === undefined) return 0

      return new Decimal(iPrice.toFixed(iDecimal)).mul(i.perSecond.mul(SECONDS_PER_YEAR)).div(new Decimal(10).pow(iDecimal)).mul(p).mul(100).toNumber()
    })

    return {
      feeApr,
      rewardsApr,
      apr: feeApr + rewardsApr.reduce((a, b) => a + b, 0)
    }
  }

  // fetch data
  static async fetchMultiplePoolInfos({ connection, poolKeys, ownerInfo, chainTime, batchRequest = false }: { connection: Connection, poolKeys: ApiAmmV3PoolInfo[], ownerInfo?: { wallet: PublicKey, tokenAccounts: TokenAccount[] }, chainTime: number, batchRequest?: boolean }): Promise<ReturnTypeFetchMultiplePoolInfos> {
    const poolAccountInfos = await getMultipleAccountsInfo(connection, poolKeys.map(i => new PublicKey(i.id)), { batchRequest })

    const programIds: PublicKey[] = []

    const poolsInfo: ReturnTypeFetchMultiplePoolInfos = {}

    for (let index = 0; index < poolKeys.length; index++) {
      const apiPoolInfo = poolKeys[index]
      const accountInfo = poolAccountInfos[index]

      if (accountInfo === null) continue

      const layoutAccountInfo = PoolInfoLayout.decode(accountInfo.data)

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
            id: new PublicKey(apiPoolInfo.ammConfig.id)
          },

          programId: accountInfo.owner,
          version: 6,

          tickSpacing: layoutAccountInfo.tickSpacing,
          liquidity: layoutAccountInfo.liquidity,
          sqrtPriceX64: layoutAccountInfo.sqrtPriceX64,
          currentPrice: SqrtPriceMath.sqrtPriceX64ToPrice(layoutAccountInfo.sqrtPriceX64, layoutAccountInfo.mintDecimalsA, layoutAccountInfo.mintDecimalsB),
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
            rewardInfos: layoutAccountInfo.rewardInfos.filter(i => !i.tokenMint.equals(PublicKey.default))
          }),

          day: apiPoolInfo.day,
          week: apiPoolInfo.week,
          month: apiPoolInfo.month,
          tvl: apiPoolInfo.tvl
        }
      }

      if (!programIds.find(i => i.equals(accountInfo.owner))) programIds.push(accountInfo.owner)
    }

    if (ownerInfo) {
      const allMint = ownerInfo.tokenAccounts.map(i => i.accountInfo.mint)
      const allPositionKey: PublicKey[] = []
      for (const itemMint of allMint) {
        for (const itemProgramId of programIds) {
          allPositionKey.push(await (await getPdaPersonalPositionAddress(itemProgramId, itemMint)).publicKey)
        }
      }

      const positionAccountInfos = await getMultipleAccountsInfo(connection, allPositionKey, { batchRequest })

      const keyToTickArrayAddress: { [key: string]: PublicKey } = {}
      for (const itemAccountInfo of positionAccountInfos) {
        if (itemAccountInfo === null) continue
        // TODO: add check

        const position = PositionInfoLayout.decode(itemAccountInfo.data)
        const itemPoolId = position.poolId.toString()
        const poolInfoA = poolsInfo[itemPoolId]
        if (poolInfoA === undefined) continue

        const poolInfo = poolInfoA.state

        const priceLower = this.getTickPrice({
          poolInfo,
          tick: position.tickLower,
          baseIn: true
        })
        const priceUpper = this.getTickPrice({
          poolInfo,
          tick: position.tickUpper,
          baseIn: true
        })
        const { amountA, amountB } = LiquidityMath.getAmountsFromLiquidity(poolInfo.sqrtPriceX64, priceLower.tickSqrtPriceX64, priceUpper.tickSqrtPriceX64, position.liquidity, false)

        const leverage = 1 / (1 - Math.sqrt(Math.sqrt(priceLower.price.div(priceUpper.price).toNumber())))

        poolsInfo[itemPoolId].positionAccount = [...(poolsInfo[itemPoolId].positionAccount ?? []), {
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
          rewardInfos: position.rewardInfos.map(i => ({
            ...i,
            peddingReward: new BN(0)
          })),

          leverage,
          tokenFeeAmountA: new BN(0),
          tokenFeeAmountB: new BN(0),
        }]

        const tickArrayLowerAddress = await TickUtils.getTickArrayAddressByTick(
          poolsInfo[itemPoolId].state.programId,
          position.poolId,
          position.tickLower,
          poolsInfo[itemPoolId].state.tickSpacing
        );
        const tickArrayUpperAddress = await TickUtils.getTickArrayAddressByTick(
          poolsInfo[itemPoolId].state.programId,
          position.poolId,
          position.tickUpper,
          poolsInfo[itemPoolId].state.tickSpacing
        );
        keyToTickArrayAddress[`${poolsInfo[itemPoolId].state.programId.toString()}-${position.poolId.toString()}-${position.tickLower}`] = tickArrayLowerAddress
        keyToTickArrayAddress[`${poolsInfo[itemPoolId].state.programId.toString()}-${position.poolId.toString()}-${position.tickUpper}`] = tickArrayUpperAddress
      }

      const tickArrayKeys = Object.values(keyToTickArrayAddress)
      const tickArrayDatas = await getMultipleAccountsInfo(connection, tickArrayKeys, { batchRequest })
      const tickArrayLayout = {}
      for (let index = 0; index < tickArrayKeys.length; index++) {
        const tickArrayData = tickArrayDatas[index]
        if (tickArrayData === null) continue
        const key = tickArrayKeys[index].toString()
        tickArrayLayout[key] = TickArrayLayout.decode(tickArrayData.data)
      }

      for (const { state, positionAccount } of Object.values(poolsInfo)) {
        if (!positionAccount) continue
        for (const itemPA of positionAccount) {
          const keyLower = `${state.programId.toString()}-${state.id.toString()}-${itemPA.tickLower}`
          const keyUpper = `${state.programId.toString()}-${state.id.toString()}-${itemPA.tickUpper}`
          const tickArrayLower = tickArrayLayout[keyToTickArrayAddress[keyLower].toString()]
          const tickArrayUpper = tickArrayLayout[keyToTickArrayAddress[keyUpper].toString()]
          const tickLowerState: Tick = tickArrayLower.ticks[TickUtils.getTickOffsetInArray(
            itemPA.tickLower,
            state.tickSpacing
          )]
          const tickUpperState: Tick = tickArrayUpper.ticks[TickUtils.getTickOffsetInArray(
            itemPA.tickUpper,
            state.tickSpacing
          )]
          const { tokenFeeAmountA, tokenFeeAmountB } = await PositionUtils.GetPositionFees(state, itemPA, tickLowerState, tickUpperState)
          const rewardInfos = await PositionUtils.GetPositionRewards(state, itemPA, tickLowerState, tickUpperState)
          itemPA.tokenFeeAmountA = tokenFeeAmountA.gte(ZERO) ? tokenFeeAmountA : ZERO
          itemPA.tokenFeeAmountB = tokenFeeAmountB.gte(ZERO) ? tokenFeeAmountB : ZERO
          for (let i = 0; i < rewardInfos.length; i++) {
            itemPA.rewardInfos[i].peddingReward = rewardInfos[i].gte(ZERO) ? rewardInfos[i] : ZERO
          }
        }
      }
    }

    return poolsInfo
  }

  static async fetchMultiplePoolTickArrays({ connection, poolKeys, batchRequest }: { connection: Connection, poolKeys: AmmV3PoolInfo[], batchRequest?: boolean }): Promise<ReturnTypeFetchMultiplePoolTickArrays> {
    const tickArraysToPoolId = {}
    const tickArrays: { pubkey: PublicKey }[] = []
    for (const itemPoolInfo of poolKeys) {
      const tickArrayBitmap = TickUtils.mergeTickArrayBitmap(itemPoolInfo.tickArrayBitmap);
      const currentTickArrayStartIndex = TickUtils.getTickArrayStartIndexByTick(itemPoolInfo.tickCurrent, itemPoolInfo.tickSpacing);

      const startIndexArray = TickUtils.getInitializedTickArrayInRange(tickArrayBitmap, itemPoolInfo.tickSpacing, currentTickArrayStartIndex, Math.floor(FETCH_TICKARRAY_COUNT / 2));
      for (const itemIndex of startIndexArray) {
        const { publicKey: tickArrayAddress } = await getPdaTickArrayAddress(
          itemPoolInfo.programId,
          itemPoolInfo.id,
          itemIndex
        );
        tickArrays.push({ pubkey: tickArrayAddress });
        tickArraysToPoolId[tickArrayAddress.toString()] = itemPoolInfo.id
      }
    }

    const fetchedTickArrays = (await getMultipleAccountsInfoWithCustomFlags(connection, tickArrays, { batchRequest }))

    const tickArrayCache: ReturnTypeFetchMultiplePoolTickArrays = {}

    for (const itemAccountInfo of fetchedTickArrays) {
      if (!itemAccountInfo.accountInfo) continue
      const poolId = tickArraysToPoolId[itemAccountInfo.pubkey.toString()]
      if (!poolId) continue
      if (tickArrayCache[poolId] === undefined) tickArrayCache[poolId] = {}

      const accountLayoutData = TickArrayLayout.decode(itemAccountInfo.accountInfo.data)

      tickArrayCache[poolId][accountLayoutData.startTickIndex] = {
        ...accountLayoutData,
        address: itemAccountInfo.pubkey
      }
    }
    return tickArrayCache;
  }
}