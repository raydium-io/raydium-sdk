import { Keypair, PublicKey, Signer, Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";
import { Numberish } from "../../common/bignumber";
import { Fraction } from "../../module/fraction";
import { SplToken } from "../token/type";
import { TokenAmount, CurrencyAmount, Percent, Price } from "../../module";
import { TickArray } from "./utils/tick";
export { ApiAmmV3PoolInfo } from "../../api/type";

export interface ApiAmmV3Point {
  price: string;
  liquidity: string;
}

export interface ApiAmmV3ConfigInfo {
  id: string;
  index: number;
  protocolFeeRate: number;
  tradeFeeRate: number;
  tickSpacing: number;
}
export interface ApiAmmV3ConfigInfos {
  [configId: string]: ApiAmmV3ConfigInfo;
}

export interface AmmV3ConfigInfo {
  id: PublicKey;
  index: number;
  protocolFeeRate: number;
  tradeFeeRate: number;
  tickSpacing: number;
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
}
export interface AmmV3PoolInfo {
  id: PublicKey;
  mintA: {
    mint: PublicKey;
    vault: PublicKey;
    decimals: number;
  };
  mintB: {
    mint: PublicKey;
    vault: PublicKey;
    decimals: number;
  };

  ammConfig: AmmV3ConfigInfo;
  observationId: PublicKey;

  programId: PublicKey;
  version: 6;

  tickSpacing: number;
  liquidity: BN;
  sqrtPriceX64: BN;
  currentPrice: Decimal;
  tickCurrent: number;
  observationIndex: number;
  observationUpdateDuration: number;
  feeGrowthGlobalX64A: BN;
  feeGrowthGlobalX64B: BN;
  protocolFeesTokenA: BN;
  protocolFeesTokenB: BN;
  swapInAmountTokenA: BN;
  swapOutAmountTokenB: BN;
  swapInAmountTokenB: BN;
  swapOutAmountTokenA: BN;
  tickArrayBitmap: BN[];

  rewardInfos: AmmV3PoolRewardInfo[];

  day: {
    volume: number;
    volumeFee: number;
    feeA: number;
    feeB: number;
    feeApr: number;
    rewardApr: {
      A: number;
      B: number;
      C: number;
    };
    apr: number;
  };
  week: {
    volume: number;
    volumeFee: number;
    feeA: number;
    feeB: number;
    feeApr: number;
    rewardApr: {
      A: number;
      B: number;
      C: number;
    };
    apr: number;
  };
  month: {
    volume: number;
    volumeFee: number;
    feeA: number;
    feeB: number;
    feeApr: number;
    rewardApr: {
      A: number;
      B: number;
      C: number;
    };
    apr: number;
  };
  tvl: number;
}

export interface AmmV3PoolPersonalPosition {
  poolId: PublicKey;
  nftMint: PublicKey;

  priceLower: Decimal;
  priceUpper: Decimal;
  amountA: BN;
  amountB: BN;
  tickLower: number;
  tickUpper: number;
  liquidity: BN;
  feeGrowthInsideLastX64A: BN;
  feeGrowthInsideLastX64B: BN;
  tokenFeesOwedA: BN;
  tokenFeesOwedB: BN;
  rewardInfos: {
    growthInsideLastX64: BN;
    rewardAmountOwed: BN;
    peddingReward: BN;
  }[];

  leverage: number;
  tokenFeeAmountA: BN;
  tokenFeeAmountB: BN;
}

export type SDKParsedConcentratedInfo = {
  state: AmmV3PoolInfo;
  positionAccount?: AmmV3PoolPersonalPosition[];
};

export interface HydratedConcentratedInfo extends SDKParsedConcentratedInfo {
  protocolFeeRate: Percent;
  tradeFeeRate: Percent;
  base: SplToken | undefined;
  quote: SplToken | undefined;
  id: PublicKey;
  userPositionAccount?: UserPositionAccount[];
  name: string;
  idString: string;

  ammConfig: AmmV3PoolInfo["ammConfig"];
  currentPrice: Fraction;
  rewardInfos: {
    rewardToken: SplToken | undefined;
    rewardState: number;
    openTime: number;
    endTime: number;
    lastUpdateTime: number;
    rewardTotalEmissioned: TokenAmount | undefined;
    rewardClaimed: TokenAmount | undefined;
    tokenMint: PublicKey;
    tokenVault: PublicKey;
    authority: PublicKey;
    emissionsPerSecondX64: BN;
    rewardGrowthGlobalX64: BN;
  }[];
  tvl: CurrencyAmount;
  feeApr24h: Percent;
  feeApr7d: Percent;
  feeApr30d: Percent;
  totalApr24h: Percent;
  totalApr7d: Percent;
  totalApr30d: Percent;

  volume24h: CurrencyAmount;
  volume7d: CurrencyAmount;
  volume30d: CurrencyAmount;

  fee24hA?: TokenAmount;
  fee24hB?: TokenAmount;
  fee7dA?: TokenAmount;
  fee7dB?: TokenAmount;
  fee30dA?: TokenAmount;
  fee30dB?: TokenAmount;

  volumeFee24h: CurrencyAmount;
  volumeFee7d: CurrencyAmount;
  volumeFee30d: CurrencyAmount;

  rewardApr24h: Percent[];
  rewardApr7d: Percent[];
  rewardApr30d: Percent[];
}

export interface MintInfo {
  mint: PublicKey;
  decimals: number;
}

export interface ReturnTypeMakeTransaction {
  signers: (Signer | Keypair)[];
  transaction: Transaction;
  address: { [name: string]: PublicKey };
}

export interface ReturnTypeMakeCreatePoolTransaction {
  signers: (Signer | Keypair)[];
  transaction: Transaction;
  mockPoolInfo: AmmV3PoolInfo;
}
export interface ReturnTypeMakeInstructions {
  signers: (Signer | Keypair)[];
  instructions: TransactionInstruction[];
  address: { [name: string]: PublicKey };
}
export interface ReturnTypeGetLiquidityAmountOutFromAmountIn {
  liquidity: BN;
  amountSlippageA: BN;
  amountSlippageB: BN;
  amountA: BN;
  amountB: BN;
}
export interface ReturnTypeGetAmountsFromLiquidity {
  amountSlippageA: BN;
  amountSlippageB: BN;
}
export interface ReturnTypeGetPriceAndTick {
  tick: number;
  price: Decimal;
}
export interface ReturnTypeComputeAmountOutFormat {
  amountOut: TokenAmount;
  minAmountOut: TokenAmount;
  currentPrice: Price;
  executionPrice: Price;
  priceImpact: Percent;
  fee: TokenAmount;
  remainingAccounts: PublicKey[];
}
export interface ReturnTypeComputeAmountOut {
  amountOut: BN;
  minAmountOut: BN;
  currentPrice: Decimal;
  executionPrice: Decimal;
  priceImpact: Percent;
  fee: BN;
  remainingAccounts: PublicKey[];
}
export interface ReturnTypeFetchMultiplePoolInfos {
  [id: string]: {
    state: AmmV3PoolInfo;
    positionAccount?: AmmV3PoolPersonalPosition[] | undefined;
  };
}
export interface ReturnTypeFetchMultiplePoolTickArrays {
  [poolId: string]: { [key: string]: TickArray };
}

export interface CreateConcentratedPool {
  programId: PublicKey;
  owner: PublicKey;
  mint1: MintInfo;
  mint2: MintInfo;
  ammConfig: AmmV3ConfigInfo;
  initialPrice: Decimal;
}

export interface UserPositionAccount {
  /** transform to SDK function, should not used directlly in UI */
  sdkParsed: AmmV3PoolPersonalPosition;
  rewardInfos: {
    penddingReward: TokenAmount | undefined;
    apr24h: Percent;
    apr7d: Percent;
    apr30d: Percent;
  }[];
  inRange: boolean;
  poolId: PublicKey;
  nftMint: PublicKey;
  priceLower: Numberish;
  priceUpper: Numberish;
  amountA?: TokenAmount;
  amountB?: TokenAmount;
  tokenA?: SplToken;
  tokenB?: SplToken;
  leverage: number;
  tickLower: number;
  tickUpper: number;
  positionPercentA: Percent;
  positionPercentB: Percent;
  tokenFeeAmountA?: TokenAmount;
  tokenFeeAmountB?: TokenAmount;
  getLiquidityVolume: (tokenPrices: Record<string, Price>) => {
    wholeLiquidity: Fraction | undefined;
    baseLiquidity: Fraction | undefined;
    quoteLiquidity: Fraction | undefined;
  };
}

export interface IncreaseLiquidity {
  poolId: PublicKey;
  ownerPosition: AmmV3PoolPersonalPosition;
  ownerInfo: {
    useSOLBalance?: boolean;
    closePosition?: boolean;
  };

  liquidity: BN;
  slippage: number;
}
