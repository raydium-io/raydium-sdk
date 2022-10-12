// import {
//   Connection,
//   Keypair,
//   PublicKey,
//   Signer,
//   SystemProgram,
//   Transaction,
//   TransactionInstruction,
// } from "@solana/web3.js";
// import BN from "bn.js";
// import Decimal from "decimal.js";

// import { TokenAccountRaw } from "../account/types";
// import { getMultipleAccountsInfoWithCustomFlags, Logger, BN_ZERO } from "../../common";
// import { Currency, Percent, Price, Token, TokenAmount } from "../../module";
// import { TOKEN_WSOL } from "../token/constant";

// import {
//   addComputations,
//   closePositionInstruction,
//   collectRewardInstruction,
//   createPoolInstruction,
//   decreaseLiquidityInstruction,
//   increaseLiquidityInstruction,
//   initRewardInstruction,
//   openPositionInstruction,
//   setRewardInstruction,
//   swapInstruction,
// } from "./instrument";
// import { ObservationInfoLayout, TickArrayLayout } from "./layout";
// import { MAX_SQRT_PRICE_X64, MIN_SQRT_PRICE_X64, ONE } from "./utils/constants";
// import { LiquidityMath, MathUtil, SqrtPriceMath, TickMath } from "./utils/math";
// import {
//   getATAAddress,
//   getPdaMetadataKey,
//   getPdaPersonalPositionAddress,
//   getPdaPoolId,
//   getPdaPoolRewardVaulId,
//   getPdaPoolVaultId,
//   getPdaProtocolPositionAddress,
//   getPdaTickArrayAddress,
// } from "./utils/pda";
// import { PoolUtils } from "./utils/pool";
// import { TickArray, TickUtils } from "./utils/tick";
// import { FETCH_TICKARRAY_COUNT } from "./utils/tickQuery";
// import {
//   AmmV3PoolInfo,
//   AmmV3PoolPersonalPosition,
//   AmmV3ConfigInfo,
//   MintInfo,
//   ReturnTypeMakeTransaction,
//   ReturnTypeMakeCreatePoolTransaction,
//   ReturnTypeMakeInstructions,
//   ReturnTypeGetLiquidityAmountOutFromAmountIn,
//   ReturnTypeGetAmountsFromLiquidity,
//   ReturnTypeGetPriceAndTick,
//   ReturnTypeComputeAmountOutFormat,
//   ReturnTypeComputeAmountOut,
//   ReturnTypeFetchMultiplePoolTickArrays,
// } from "./type";

// const logger = Logger.from("AmmV3");

// export class AmmV3 {
//   // transaction
//   static async makeCreatePoolTransaction({
//     connection,
//     programId,
//     owner,
//     mint1,
//     mint2,
//     ammConfig,
//     initialPrice,
//   }: {
//     connection: Connection;
//     programId: PublicKey;
//     owner: PublicKey;
//     mint1: MintInfo;
//     mint2: MintInfo;
//     ammConfig: AmmV3ConfigInfo;
//     initialPrice: Decimal;
//   }): Promise<ReturnTypeMakeCreatePoolTransaction> {
//     const [mintA, mintB, initPrice] =
//       mint1.mint > mint2.mint ? [mint2, mint1, new Decimal(1).div(initialPrice)] : [mint1, mint2, initialPrice];

//     const initialPriceX64 = SqrtPriceMath.priceToSqrtPriceX64(initPrice, mintA.decimals, mintB.decimals);

//     const transaction = new Transaction();
//     transaction.add(addComputations());

//     const insInfo = await this.makeCreatePoolInstructions({
//       connection,
//       programId,
//       owner,
//       mintA,
//       mintB,
//       ammConfigId: ammConfig.id,
//       initialPriceX64,
//     });

//     transaction.add(...insInfo.instructions);

//     return {
//       signers: insInfo.signers,
//       transaction,
//       mockPoolInfo: {
//         id: insInfo.address.poolId,
//         mintA: {
//           mint: mintA.mint,
//           vault: insInfo.address.mintAVault,
//           decimals: mintA.decimals,
//         },
//         mintB: {
//           mint: mintB.mint,
//           vault: insInfo.address.mintBVault,
//           decimals: mintB.decimals,
//         },

//         ammConfig,
//         observationId: insInfo.address.observationId,

//         programId,
//         version: 6,

//         tickSpacing: ammConfig.tickSpacing,
//         liquidity: BN_ZERO,
//         sqrtPriceX64: initialPriceX64,
//         currentPrice: initPrice,
//         tickCurrent: 0,
//         observationIndex: 0,
//         observationUpdateDuration: 0,
//         feeGrowthGlobalX64A: BN_ZERO,
//         feeGrowthGlobalX64B: BN_ZERO,
//         protocolFeesTokenA: BN_ZERO,
//         protocolFeesTokenB: BN_ZERO,
//         swapInAmountTokenA: BN_ZERO,
//         swapOutAmountTokenB: BN_ZERO,
//         swapInAmountTokenB: BN_ZERO,
//         swapOutAmountTokenA: BN_ZERO,
//         tickArrayBitmap: [],

//         rewardInfos: [],

//         day: { volume: 0, volumeFee: 0, feeA: 0, feeB: 0, feeApr: 0, rewardApr: { A: 0, B: 0, C: 0 }, apr: 0 },
//         week: { volume: 0, volumeFee: 0, feeA: 0, feeB: 0, feeApr: 0, rewardApr: { A: 0, B: 0, C: 0 }, apr: 0 },
//         month: { volume: 0, volumeFee: 0, feeA: 0, feeB: 0, feeApr: 0, rewardApr: { A: 0, B: 0, C: 0 }, apr: 0 },
//         tvl: 0,
//       },
//     };
//   }

//   static async makeOpenPositionTransaction({
//     connection,
//     poolInfo,
//     ownerInfo,
//     tickLower,
//     tickUpper,
//     liquidity,
//     slippage,
//   }: {
//     connection: Connection;
//     poolInfo: AmmV3PoolInfo;

//     ownerInfo: {
//       feePayer: PublicKey;
//       wallet: PublicKey;
//       tokenAccounts: TokenAccountRaw[];
//       useSOLBalance?: boolean; // if has WSOL mint (default: true)
//     };

//     // priceLower: Decimal,
//     // priceUpper: Decimal,

//     tickLower: number;
//     tickUpper: number;

//     liquidity: BN;
//     slippage: number;
//   }): Promise<ReturnTypeMakeTransaction> {
//     const frontInstructions: TransactionInstruction[] = [];
//     const endInstructions: TransactionInstruction[] = [];

//     const signers: Signer[] = [];

//     // const tickLower = TickMath.getTickWithPriceAndTickspacing(
//     //   priceLower,
//     //   poolInfo.ammConfig.tickSpacing,
//     //   poolInfo.mintA.decimals,
//     //   poolInfo.mintB.decimals
//     // );
//     // const tickUpper = TickMath.getTickWithPriceAndTickspacing(
//     //   priceUpper,
//     //   poolInfo.ammConfig.tickSpacing,
//     //   poolInfo.mintA.decimals,
//     //   poolInfo.mintB.decimals
//     // );

//     const { amountSlippageA, amountSlippageB } = LiquidityMath.getAmountsFromLiquidityWithSlippage(
//       poolInfo.sqrtPriceX64,
//       SqrtPriceMath.getSqrtPriceX64FromTick(tickLower),
//       SqrtPriceMath.getSqrtPriceX64FromTick(tickUpper),
//       liquidity,
//       true,
//       true,
//       slippage,
//     );

//     let ownerTokenAccountA: PublicKey | null;
//     let ownerTokenAccountB: PublicKey | null;
//     if (poolInfo.mintA.mint.equals(new PublicKey(WSOL.mint)) && ownerInfo.useSOLBalance) {
//       // mintA
//       ownerTokenAccountA = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: amountSlippageA,
//         mint: poolInfo.mintA.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerTokenAccountA = await this._selectTokenAccount({
//         tokenAccounts: ownerInfo.tokenAccounts,
//         mint: poolInfo.mintA.mint,
//         owner: ownerInfo.wallet,
//         config: { associatedOnly: false },
//       });
//     }
//     if (poolInfo.mintB.mint.equals(new PublicKey(TOKEN_WSOL.mint)) && ownerInfo.useSOLBalance) {
//       // mintB
//       ownerTokenAccountB = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: amountSlippageB,
//         mint: poolInfo.mintB.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerTokenAccountB = await this._selectTokenAccount({
//         tokenAccounts: ownerInfo.tokenAccounts,
//         mint: poolInfo.mintB.mint,
//         owner: ownerInfo.wallet,
//         config: { associatedOnly: false },
//       });
//     }

//     logger.assertArgument(
//       !!ownerTokenAccountA || !!ownerTokenAccountB,
//       "cannot found target token accounts",
//       "tokenAccounts",
//       ownerInfo.tokenAccounts,
//     );

//     const transaction = new Transaction();
//     transaction.add(addComputations());

//     const insInfo = await this.makeOpenPositionInstructions({
//       poolInfo,
//       ownerInfo: {
//         ...ownerInfo,
//         tokenAccountA: ownerTokenAccountA!,
//         tokenAccountB: ownerTokenAccountB!,
//       },
//       tickLower,
//       tickUpper,
//       liquidity,
//       amountSlippageA,
//       amountSlippageB,
//     });

//     transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions);

//     return {
//       signers: [...signers, ...insInfo.signers],
//       transaction,
//       address: { ...insInfo.address },
//     };
//   }

//   static async makeIncreaseLiquidityTransaction({
//     connection,
//     poolInfo,
//     ownerPosition,
//     ownerInfo,
//     liquidity,
//     slippage,
//   }: {
//     connection: Connection;
//     poolInfo: AmmV3PoolInfo;
//     ownerPosition: AmmV3PoolPersonalPosition;
//     ownerInfo: {
//       feePayer: PublicKey;
//       wallet: PublicKey;
//       tokenAccounts: TokenAccountRaw[];
//       useSOLBalance?: boolean; // if has WSOL mint
//     };

//     liquidity: BN;
//     slippage: number;
//   }): Promise<ReturnTypeMakeTransaction> {
//     const frontInstructions: TransactionInstruction[] = [];
//     const endInstructions: TransactionInstruction[] = [];

//     const signers: Signer[] = [];

//     const { amountSlippageA, amountSlippageB } = LiquidityMath.getAmountsFromLiquidityWithSlippage(
//       poolInfo.sqrtPriceX64,
//       SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickLower),
//       SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickUpper),
//       liquidity,
//       true,
//       true,
//       slippage,
//     );
//     let ownerTokenAccountA: PublicKey | null;
//     let ownerTokenAccountB: PublicKey | null;
//     if (poolInfo.mintA.mint.equals(new PublicKey(TOKEN_WSOL.mint)) && ownerInfo.useSOLBalance) {
//       // mintA
//       ownerTokenAccountA = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: amountSlippageA,
//         mint: poolInfo.mintA.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerTokenAccountA = await this._selectTokenAccount({
//         tokenAccounts: ownerInfo.tokenAccounts,
//         mint: poolInfo.mintA.mint,
//         owner: ownerInfo.wallet,
//         config: { associatedOnly: false },
//       });
//     }
//     if (poolInfo.mintB.mint.equals(new PublicKey(TOKEN_WSOL.mint)) && ownerInfo.useSOLBalance) {
//       // mintB
//       ownerTokenAccountB = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: amountSlippageB,
//         mint: poolInfo.mintB.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerTokenAccountB = await this._selectTokenAccount({
//         tokenAccounts: ownerInfo.tokenAccounts,
//         mint: poolInfo.mintB.mint,
//         owner: ownerInfo.wallet,
//         config: { associatedOnly: false },
//       });
//     }

//     logger.assertArgument(
//       !!ownerTokenAccountA || !!ownerTokenAccountB,
//       "cannot found target token accounts",
//       "tokenAccounts",
//       ownerInfo.tokenAccounts,
//     );

//     const transaction = new Transaction();
//     transaction.add(addComputations());

//     const insInfo = await this.makeIncreaseLiquidityInstructions({
//       poolInfo,
//       ownerPosition,
//       ownerInfo: {
//         wallet: ownerInfo.wallet,
//         tokenAccountA: ownerTokenAccountA!,
//         tokenAccountB: ownerTokenAccountB!,
//       },
//       liquidity,
//       amountSlippageA,
//       amountSlippageB,
//     });

//     transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions);

//     return {
//       signers: [...signers, ...insInfo.signers],
//       transaction,
//       address: { ...insInfo.address },
//     };
//   }

//   static async makeDecreaseLiquidityTransaction({
//     connection,
//     poolInfo,
//     ownerPosition,
//     ownerInfo,
//     liquidity,
//     slippage,
//   }: {
//     connection: Connection;
//     poolInfo: AmmV3PoolInfo;
//     ownerPosition: AmmV3PoolPersonalPosition;
//     ownerInfo: {
//       feePayer: PublicKey;
//       wallet: PublicKey;
//       tokenAccounts: TokenAccountRaw[];
//       useSOLBalance?: boolean; // if has WSOL mint
//       closePosition?: boolean;
//     };

//     liquidity: BN;
//     slippage: number;
//   }): Promise<ReturnTypeMakeTransaction> {
//     const frontInstructions: TransactionInstruction[] = [];
//     const endInstructions: TransactionInstruction[] = [];

//     const signers: Signer[] = [];

//     const { amountSlippageA, amountSlippageB } = LiquidityMath.getAmountsFromLiquidityWithSlippage(
//       poolInfo.sqrtPriceX64,
//       SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickLower),
//       SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickUpper),
//       liquidity,
//       false,
//       true,
//       slippage,
//     );
//     let ownerTokenAccountA: PublicKey | null;
//     let ownerTokenAccountB: PublicKey | null;
//     if (poolInfo.mintA.mint.equals(new PublicKey(WSOL.mint)) && ownerInfo.useSOLBalance) {
//       // mintA
//       ownerTokenAccountA = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: 0,
//         mint: poolInfo.mintA.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerTokenAccountA =
//         (await this._selectTokenAccount({
//           tokenAccounts: ownerInfo.tokenAccounts,
//           mint: poolInfo.mintA.mint,
//           owner: ownerInfo.wallet,
//           config: { associatedOnly: false },
//         })) ??
//         (await this._handleTokenAccount({
//           connection,
//           side: "in",
//           amount: 0,
//           mint: poolInfo.mintA.mint,
//           tokenAccount: null,
//           owner: ownerInfo.wallet,
//           payer: ownerInfo.feePayer,
//           frontInstructions,
//           endInstructions,
//           signers,
//           bypassAssociatedCheck: true,
//         }));
//     }
//     if (poolInfo.mintB.mint.equals(new PublicKey(TOKEN_WSOL.mint)) && ownerInfo.useSOLBalance) {
//       // mintB
//       ownerTokenAccountB = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: 0,
//         mint: poolInfo.mintB.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerTokenAccountB =
//         (await this._selectTokenAccount({
//           tokenAccounts: ownerInfo.tokenAccounts,
//           mint: poolInfo.mintB.mint,
//           owner: ownerInfo.wallet,
//           config: { associatedOnly: false },
//         })) ??
//         (await this._handleTokenAccount({
//           connection,
//           side: "in",
//           amount: 0,
//           mint: poolInfo.mintB.mint,
//           tokenAccount: null,
//           owner: ownerInfo.wallet,
//           payer: ownerInfo.feePayer,
//           frontInstructions,
//           endInstructions,
//           signers,
//           bypassAssociatedCheck: true,
//         }));
//     }

//     const rewardAccounts: PublicKey[] = [];
//     for (const itemReward of poolInfo.rewardInfos) {
//       let ownerRewardAccount;
//       if (itemReward.tokenMint.equals(new PublicKey(TOKEN_WSOL.mint)) && ownerInfo.useSOLBalance) {
//         ownerRewardAccount = await this._handleTokenAccount({
//           connection,
//           side: "in",
//           amount: 0,
//           mint: itemReward.tokenMint,
//           tokenAccount: null,
//           owner: ownerInfo.wallet,
//           payer: ownerInfo.feePayer,
//           frontInstructions,
//           endInstructions,
//           signers,
//           bypassAssociatedCheck: true,
//         });
//       } else {
//         ownerRewardAccount =
//           (await this._selectTokenAccount({
//             tokenAccounts: ownerInfo.tokenAccounts,
//             mint: itemReward.tokenMint,
//             owner: ownerInfo.wallet,
//             config: { associatedOnly: false },
//           })) ??
//           (await this._handleTokenAccount({
//             connection,
//             side: "in",
//             amount: 0,
//             mint: poolInfo.mintB.mint,
//             tokenAccount: null,
//             owner: ownerInfo.wallet,
//             payer: ownerInfo.feePayer,
//             frontInstructions,
//             endInstructions,
//             signers,
//             bypassAssociatedCheck: true,
//           }));
//       }
//       rewardAccounts.push(ownerRewardAccount);
//     }

//     logger.assertArgument(
//       !!ownerTokenAccountA || !!ownerTokenAccountB,
//       "cannot found target token accounts",
//       "tokenAccounts",
//       ownerInfo.tokenAccounts,
//     );

//     const transaction = new Transaction();
//     transaction.add(addComputations());

//     const insInfo = await this.makeDecreaseLiquidityInstructions({
//       poolInfo,
//       ownerPosition,
//       ownerInfo: {
//         wallet: ownerInfo.wallet,
//         tokenAccountA: ownerTokenAccountA!,
//         tokenAccountB: ownerTokenAccountB!,
//         rewardAccounts,
//       },
//       liquidity,
//       amountSlippageA,
//       amountSlippageB,
//     });

//     transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions);

//     if (ownerInfo.closePosition) {
//       transaction.add(
//         ...(
//           await this.makeClosePositionInstructions({
//             poolInfo,
//             ownerInfo,
//             ownerPosition,
//           })
//         ).instructions,
//       );
//     }

//     return {
//       signers: [...signers, ...insInfo.signers],
//       transaction,
//       address: { ...insInfo.address },
//     };
//   }

//   static async makeSwapBaseInTransaction({
//     connection,
//     poolInfo,
//     ownerInfo,

//     inputMint,
//     amountIn,
//     amountOutMin,
//     priceLimit,

//     remainingAccounts,
//   }: {
//     connection: Connection;
//     poolInfo: AmmV3PoolInfo;
//     ownerInfo: {
//       feePayer: PublicKey;
//       wallet: PublicKey;
//       tokenAccounts: TokenAccountRaw[];
//       useSOLBalance?: boolean; // if has WSOL mint
//     };

//     inputMint: PublicKey;
//     amountIn: BN;
//     amountOutMin: BN;
//     priceLimit?: Decimal;

//     remainingAccounts: PublicKey[];
//   }): Promise<ReturnTypeMakeTransaction> {
//     const frontInstructions: TransactionInstruction[] = [];
//     const endInstructions: TransactionInstruction[] = [];

//     const signers: Signer[] = [];

//     let sqrtPriceLimitX64: BN;
//     if (!priceLimit || priceLimit.equals(new Decimal(0))) {
//       sqrtPriceLimitX64 = inputMint.equals(poolInfo.mintA.mint)
//         ? MIN_SQRT_PRICE_X64.add(ONE)
//         : MAX_SQRT_PRICE_X64.sub(ONE);
//     } else {
//       sqrtPriceLimitX64 = SqrtPriceMath.priceToSqrtPriceX64(
//         priceLimit,
//         poolInfo.mintA.decimals,
//         poolInfo.mintB.decimals,
//       );
//     }

//     const isInputMintA = poolInfo.mintA.mint.equals(inputMint);

//     let ownerTokenAccountA: PublicKey | null;
//     let ownerTokenAccountB: PublicKey | null;
//     if (poolInfo.mintA.mint.equals(new PublicKey(TOKEN_WSOL.mint)) && ownerInfo.useSOLBalance) {
//       // mintA
//       ownerTokenAccountA = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: isInputMintA ? amountIn : 0,
//         mint: poolInfo.mintA.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerTokenAccountA = await this._selectTokenAccount({
//         tokenAccounts: ownerInfo.tokenAccounts,
//         mint: poolInfo.mintA.mint,
//         owner: ownerInfo.wallet,
//         config: { associatedOnly: false },
//       });
//     }
//     if (poolInfo.mintB.mint.equals(new PublicKey(TOKEN_WSOL.mint)) && ownerInfo.useSOLBalance) {
//       // mintB
//       ownerTokenAccountB = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: !isInputMintA ? amountIn : 0,
//         mint: poolInfo.mintB.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerTokenAccountB = await this._selectTokenAccount({
//         tokenAccounts: ownerInfo.tokenAccounts,
//         mint: poolInfo.mintB.mint,
//         owner: ownerInfo.wallet,
//         config: { associatedOnly: false },
//       });
//     }

//     logger.assertArgument(
//       !!ownerTokenAccountA || !!ownerTokenAccountB,
//       "cannot found target token accounts",
//       "tokenAccounts",
//       ownerInfo.tokenAccounts,
//     );

//     const transaction = new Transaction();
//     transaction.add(addComputations());

//     const insInfo = await this.makeSwapBaseInInstructions({
//       poolInfo,
//       ownerInfo: {
//         wallet: ownerInfo.wallet,
//         tokenAccountA: ownerTokenAccountA!,
//         tokenAccountB: ownerTokenAccountB!,
//       },

//       inputMint,

//       amountIn,
//       amountOutMin,
//       sqrtPriceLimitX64,

//       remainingAccounts,
//     });

//     transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions);

//     return {
//       signers: [...signers, ...insInfo.signers],
//       transaction,
//       address: { ...insInfo.address },
//     };
//   }

//   static async makeCLosePositionTransaction({
//     poolInfo,
//     ownerPosition,
//     ownerInfo,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     ownerPosition: AmmV3PoolPersonalPosition;

//     ownerInfo: {
//       wallet: PublicKey;
//     };
//   }): Promise<ReturnTypeMakeTransaction> {
//     const ins = await this.makeClosePositionInstructions({ poolInfo, ownerInfo, ownerPosition });
//     const transaction = new Transaction();
//     transaction.add(...ins.instructions);

//     return {
//       signers: ins.signers,
//       transaction,
//       address: { ...ins.address },
//     };
//   }

//   static async makeInitRewardTransaction({
//     connection,
//     poolInfo,
//     ownerInfo,
//     rewardInfo,
//   }: {
//     connection: Connection;
//     poolInfo: AmmV3PoolInfo;
//     ownerInfo: {
//       feePayer: PublicKey;
//       wallet: PublicKey;
//       tokenAccounts: TokenAccountRaw[];
//       useSOLBalance?: boolean; // if has WSOL mint
//     };

//     rewardInfo: {
//       index: 1 | 2;
//       mint: PublicKey;
//       decimals: number;
//       openTime: number;
//       endTime: number;
//       perSecond: BN;
//     };
//   }): Promise<ReturnTypeMakeTransaction> {
//     logger.assertArgument(rewardInfo.endTime > rewardInfo.openTime, "reward time error", "rewardInfo", rewardInfo);

//     const frontInstructions: TransactionInstruction[] = [];
//     const endInstructions: TransactionInstruction[] = [];

//     const signers: Signer[] = [];

//     let ownerRewardAccount: PublicKey | null;
//     if (ownerInfo.useSOLBalance) {
//       ownerRewardAccount = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: rewardInfo.perSecond.sub(new BN(rewardInfo.endTime - rewardInfo.openTime)),
//         mint: rewardInfo.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerRewardAccount = await this._selectTokenAccount({
//         tokenAccounts: ownerInfo.tokenAccounts,
//         mint: poolInfo.mintA.mint,
//         owner: ownerInfo.wallet,
//         config: { associatedOnly: false },
//       });
//     }

//     logger.assertArgument(ownerRewardAccount, "no money", "ownerRewardAccount", ownerInfo.tokenAccounts);

//     const transaction = new Transaction();
//     transaction.add(addComputations());

//     const insInfo = this.makeInitRewardInstructions({
//       poolInfo,
//       ownerInfo: {
//         wallet: ownerInfo.wallet,
//         tokenAccount: ownerRewardAccount!,
//       },
//       rewardInfo: {
//         index: rewardInfo.index,
//         mint: rewardInfo.mint,
//         vault: (await getPdaPoolRewardVaulId(poolInfo.programId, poolInfo.id, rewardInfo.mint)).publicKey,
//         openTime: rewardInfo.openTime,
//         endTime: rewardInfo.endTime,
//         emissionsPerSecondX64: MathUtil.decimalToX64(
//           new Decimal(rewardInfo.perSecond.toNumber() / 10 ** rewardInfo.decimals),
//         ),
//       },
//     });

//     transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions);

//     return {
//       signers: [...signers, ...insInfo.signers],
//       transaction,
//       address: { ...insInfo.address },
//     };
//   }

//   static async makeSetRewardTransaction({
//     connection,
//     poolInfo,
//     ownerInfo,
//     rewardInfo,
//   }: {
//     connection: Connection;
//     poolInfo: AmmV3PoolInfo;
//     ownerInfo: {
//       feePayer: PublicKey;
//       wallet: PublicKey;
//       tokenAccounts: TokenAccountRaw[];
//       useSOLBalance?: boolean; // if has WSOL mint
//     };

//     rewardInfo: {
//       index: 1 | 2;
//       mint: PublicKey;
//       decimals: number;
//       openTime: number;
//       endTime: number;
//       perSecond: BN;
//     };
//   }): Promise<ReturnTypeMakeTransaction> {
//     logger.assertArgument(rewardInfo.endTime > rewardInfo.openTime, "reward time error", "rewardInfo", rewardInfo);

//     const frontInstructions: TransactionInstruction[] = [];
//     const endInstructions: TransactionInstruction[] = [];

//     const signers: Signer[] = [];

//     let ownerRewardAccount: PublicKey | null;
//     if (ownerInfo.useSOLBalance) {
//       ownerRewardAccount = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: rewardInfo.perSecond.sub(new BN(rewardInfo.endTime - rewardInfo.openTime)),
//         mint: rewardInfo.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerRewardAccount = await this._selectTokenAccount({
//         tokenAccounts: ownerInfo.tokenAccounts,
//         mint: poolInfo.mintA.mint,
//         owner: ownerInfo.wallet,
//         config: { associatedOnly: false },
//       });
//     }

//     logger.assertArgument(ownerRewardAccount, "no money", "ownerRewardAccount", ownerInfo.tokenAccounts);

//     const transaction = new Transaction();
//     transaction.add(addComputations());

//     const insInfo = this.makeSetRewardInstructions({
//       poolInfo,
//       ownerInfo: {
//         wallet: ownerInfo.wallet,
//         tokenAccount: ownerRewardAccount!,
//       },
//       rewardInfo: {
//         index: rewardInfo.index,
//         vault: (await getPdaPoolRewardVaulId(poolInfo.programId, poolInfo.id, rewardInfo.mint)).publicKey,
//         openTime: rewardInfo.openTime,
//         endTime: rewardInfo.endTime,
//         emissionsPerSecondX64: MathUtil.decimalToX64(
//           new Decimal(rewardInfo.perSecond.toNumber() / 10 ** rewardInfo.decimals),
//         ),
//       },
//     });

//     transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions);

//     return {
//       signers: [...signers, ...insInfo.signers],
//       transaction,
//       address: { ...insInfo.address },
//     };
//   }

//   static async makeCollectRewardTransaction({
//     connection,
//     poolInfo,
//     ownerInfo,
//     rewardInfo,
//   }: {
//     connection: Connection;
//     poolInfo: AmmV3PoolInfo;
//     ownerInfo: {
//       feePayer: PublicKey;
//       wallet: PublicKey;
//       tokenAccounts: TokenAccountRaw[];
//       useSOLBalance?: boolean; // if has WSOL mint
//     };

//     rewardInfo: {
//       index: 1 | 2;
//       mint: PublicKey;
//       decimals: number;
//       openTime: number;
//       endTime: number;
//       perSecond: BN;
//     };
//   }): Promise<ReturnTypeMakeTransaction> {
//     logger.assertArgument(rewardInfo.endTime > rewardInfo.openTime, "reward time error", "rewardInfo", rewardInfo);

//     const frontInstructions: TransactionInstruction[] = [];
//     const endInstructions: TransactionInstruction[] = [];

//     const signers: Signer[] = [];

//     let ownerRewardAccount: PublicKey | null;
//     if (ownerInfo.useSOLBalance) {
//       ownerRewardAccount = await this._handleTokenAccount({
//         connection,
//         side: "in",
//         amount: 0,
//         mint: rewardInfo.mint,
//         tokenAccount: null,
//         owner: ownerInfo.wallet,
//         payer: ownerInfo.feePayer,
//         frontInstructions,
//         endInstructions,
//         signers,
//         bypassAssociatedCheck: true,
//       });
//     } else {
//       ownerRewardAccount = await this._selectTokenAccount({
//         tokenAccounts: ownerInfo.tokenAccounts,
//         mint: poolInfo.mintA.mint,
//         owner: ownerInfo.wallet,
//         config: { associatedOnly: false },
//       });
//     }

//     logger.assertArgument(ownerRewardAccount, "no money", "ownerRewardAccount", ownerInfo.tokenAccounts);

//     const transaction = new Transaction();
//     transaction.add(addComputations());

//     const insInfo = this.makeCollectRewardInstructions({
//       poolInfo,
//       ownerInfo: {
//         wallet: ownerInfo.wallet,
//         tokenAccount: ownerRewardAccount!,
//       },
//       rewardInfo: {
//         index: rewardInfo.index,
//         vault: (await getPdaPoolRewardVaulId(poolInfo.programId, poolInfo.id, rewardInfo.mint)).publicKey,
//       },
//     });

//     transaction.add(...frontInstructions, ...insInfo.instructions, ...endInstructions);

//     return {
//       signers: [...signers, ...insInfo.signers],
//       transaction,
//       address: { ...insInfo.address },
//     };
//   }

//   // instrument
//   static async makeCreatePoolInstructions({
//     connection,
//     programId,
//     owner,
//     mintA,
//     mintB,
//     ammConfigId,
//     initialPriceX64,
//   }: {
//     connection: Connection;
//     programId: PublicKey;
//     owner: PublicKey;
//     mintA: MintInfo;
//     mintB: MintInfo;
//     ammConfigId: PublicKey;
//     initialPriceX64: BN;
//   }): Promise<ReturnTypeMakeInstructions> {
//     const observationId = new Keypair();
//     const ins = [
//       SystemProgram.createAccount({
//         fromPubkey: owner,
//         newAccountPubkey: observationId.publicKey,
//         lamports: await connection.getMinimumBalanceForRentExemption(ObservationInfoLayout.span),
//         space: ObservationInfoLayout.span,
//         programId,
//       }),
//     ];

//     const poolId = await (await getPdaPoolId(programId, ammConfigId, mintA.mint, mintB.mint)).publicKey;
//     const mintAVault = await (await getPdaPoolVaultId(programId, poolId, mintA.mint)).publicKey;
//     const mintBVault = await (await getPdaPoolVaultId(programId, poolId, mintB.mint)).publicKey;

//     ins.push(
//       createPoolInstruction(
//         programId,
//         poolId,
//         owner,
//         ammConfigId,
//         observationId.publicKey,
//         mintA.mint,
//         mintAVault,
//         mintB.mint,
//         mintBVault,
//         initialPriceX64,
//       ),
//     );

//     return {
//       signers: [observationId],
//       instructions: ins,
//       address: { poolId, observationId: observationId.publicKey, mintAVault, mintBVault },
//     };
//   }

//   static async makeOpenPositionInstructions({
//     poolInfo,
//     ownerInfo,
//     tickLower,
//     tickUpper,
//     liquidity,
//     amountSlippageA,
//     amountSlippageB,
//   }: {
//     poolInfo: AmmV3PoolInfo;

//     ownerInfo: {
//       feePayer: PublicKey;
//       wallet: PublicKey;
//       tokenAccountA: PublicKey;
//       tokenAccountB: PublicKey;
//     };

//     tickLower: number;
//     tickUpper: number;
//     liquidity: BN;
//     amountSlippageA: BN;
//     amountSlippageB: BN;
//   }): Promise<ReturnTypeMakeInstructions> {
//     const signers: Signer[] = [];

//     const nftMintAKeypair = new Keypair();
//     signers.push(nftMintAKeypair);

//     const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(tickLower, poolInfo.ammConfig.tickSpacing);
//     const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(tickUpper, poolInfo.ammConfig.tickSpacing);

//     const { publicKey: tickArrayLower } = await getPdaTickArrayAddress(
//       poolInfo.programId,
//       poolInfo.id,
//       tickArrayLowerStartIndex,
//     );
//     const { publicKey: tickArrayUpper } = await getPdaTickArrayAddress(
//       poolInfo.programId,
//       poolInfo.id,
//       tickArrayUpperStartIndex,
//     );

//     const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, nftMintAKeypair.publicKey);
//     const { publicKey: metadataAccount } = await getPdaMetadataKey(nftMintAKeypair.publicKey);
//     const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(
//       poolInfo.programId,
//       nftMintAKeypair.publicKey,
//     );
//     const { publicKey: protocolPosition } = await getPdaProtocolPositionAddress(
//       poolInfo.programId,
//       poolInfo.id,
//       tickLower,
//       tickUpper,
//     );

//     const ins = openPositionInstruction(
//       poolInfo.programId,
//       ownerInfo.feePayer,
//       poolInfo.id,
//       ownerInfo.wallet,
//       nftMintAKeypair.publicKey,
//       positionNftAccount,
//       metadataAccount,
//       protocolPosition,
//       tickArrayLower,
//       tickArrayUpper,
//       personalPosition,
//       ownerInfo.tokenAccountA,
//       ownerInfo.tokenAccountB,
//       poolInfo.mintA.vault,
//       poolInfo.mintB.vault,

//       tickLower,
//       tickUpper,
//       tickArrayLowerStartIndex,
//       tickArrayUpperStartIndex,
//       liquidity,
//       amountSlippageA,
//       amountSlippageB,
//     );

//     return {
//       signers: [nftMintAKeypair],
//       instructions: [ins],
//       address: {},
//     };
//   }

//   static async makeIncreaseLiquidityInstructions({
//     poolInfo,
//     ownerPosition,
//     ownerInfo,
//     liquidity,
//     amountSlippageA,
//     amountSlippageB,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     ownerPosition: AmmV3PoolPersonalPosition;

//     ownerInfo: {
//       wallet: PublicKey;
//       tokenAccountA: PublicKey;
//       tokenAccountB: PublicKey;
//     };

//     liquidity: BN;
//     amountSlippageA: BN;
//     amountSlippageB: BN;
//   }): Promise<ReturnTypeMakeInstructions> {
//     const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
//       ownerPosition.tickLower,
//       poolInfo.ammConfig.tickSpacing,
//     );
//     const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
//       ownerPosition.tickUpper,
//       poolInfo.ammConfig.tickSpacing,
//     );

//     const { publicKey: tickArrayLower } = await getPdaTickArrayAddress(
//       poolInfo.programId,
//       poolInfo.id,
//       tickArrayLowerStartIndex,
//     );
//     const { publicKey: tickArrayUpper } = await getPdaTickArrayAddress(
//       poolInfo.programId,
//       poolInfo.id,
//       tickArrayUpperStartIndex,
//     );

//     const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, ownerPosition.nftMint);

//     const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(
//       poolInfo.programId,
//       ownerPosition.nftMint,
//     );
//     const { publicKey: protocolPosition } = await getPdaProtocolPositionAddress(
//       poolInfo.programId,
//       poolInfo.id,
//       ownerPosition.tickLower,
//       ownerPosition.tickUpper,
//     );

//     const ins: TransactionInstruction[] = [];
//     ins.push(
//       increaseLiquidityInstruction(
//         poolInfo.programId,
//         ownerInfo.wallet,
//         positionNftAccount,
//         personalPosition,
//         poolInfo.id,
//         protocolPosition,
//         tickArrayLower,
//         tickArrayUpper,
//         ownerInfo.tokenAccountA,
//         ownerInfo.tokenAccountB,
//         poolInfo.mintA.vault,
//         poolInfo.mintB.vault,

//         liquidity,
//         amountSlippageA,
//         amountSlippageB,
//       ),
//     );

//     return {
//       signers: [],
//       instructions: ins,
//       address: {},
//     };
//   }

//   static async makeDecreaseLiquidityInstructions({
//     poolInfo,
//     ownerPosition,
//     ownerInfo,
//     liquidity,
//     amountSlippageA,
//     amountSlippageB,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     ownerPosition: AmmV3PoolPersonalPosition;

//     ownerInfo: {
//       wallet: PublicKey;
//       tokenAccountA: PublicKey;
//       tokenAccountB: PublicKey;
//       rewardAccounts: PublicKey[];
//     };

//     liquidity: BN;
//     amountSlippageA: BN;
//     amountSlippageB: BN;
//   }): Promise<ReturnTypeMakeInstructions> {
//     const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
//       ownerPosition.tickLower,
//       poolInfo.ammConfig.tickSpacing,
//     );
//     const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
//       ownerPosition.tickUpper,
//       poolInfo.ammConfig.tickSpacing,
//     );

//     const { publicKey: tickArrayLower } = await getPdaTickArrayAddress(
//       poolInfo.programId,
//       poolInfo.id,
//       tickArrayLowerStartIndex,
//     );
//     const { publicKey: tickArrayUpper } = await getPdaTickArrayAddress(
//       poolInfo.programId,
//       poolInfo.id,
//       tickArrayUpperStartIndex,
//     );
//     const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, ownerPosition.nftMint);

//     const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(
//       poolInfo.programId,
//       ownerPosition.nftMint,
//     );
//     const { publicKey: protocolPosition } = await getPdaProtocolPositionAddress(
//       poolInfo.programId,
//       poolInfo.id,
//       ownerPosition.tickLower,
//       ownerPosition.tickUpper,
//     );

//     const rewardAccounts: {
//       poolRewardVault: PublicKey;
//       ownerRewardVault: PublicKey;
//     }[] = [];
//     for (let i = 0; i < poolInfo.rewardInfos.length; i++) {
//       rewardAccounts.push({
//         poolRewardVault: poolInfo.rewardInfos[0].tokenVault,
//         ownerRewardVault: ownerInfo.rewardAccounts[0],
//       });
//     }

//     const ins: TransactionInstruction[] = [];
//     ins.push(
//       decreaseLiquidityInstruction(
//         poolInfo.programId,
//         ownerInfo.wallet,
//         positionNftAccount,
//         personalPosition,
//         poolInfo.id,
//         protocolPosition,
//         tickArrayLower,
//         tickArrayUpper,
//         ownerInfo.tokenAccountA,
//         ownerInfo.tokenAccountB,
//         poolInfo.mintA.vault,
//         poolInfo.mintB.vault,
//         rewardAccounts,

//         liquidity,
//         amountSlippageA,
//         amountSlippageB,
//       ),
//     );

//     return {
//       signers: [],
//       instructions: ins,
//       address: {},
//     };
//   }

//   static async makeClosePositionInstructions({
//     poolInfo,
//     ownerInfo,
//     ownerPosition,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     ownerPosition: AmmV3PoolPersonalPosition;

//     ownerInfo: {
//       wallet: PublicKey;
//     };
//   }): Promise<ReturnTypeMakeInstructions> {
//     const { publicKey: positionNftAccount } = await getATAAddress(ownerInfo.wallet, ownerPosition.nftMint);
//     const { publicKey: personalPosition } = await getPdaPersonalPositionAddress(
//       poolInfo.programId,
//       ownerPosition.nftMint,
//     );

//     const ins: TransactionInstruction[] = [];
//     ins.push(
//       closePositionInstruction(
//         poolInfo.programId,

//         ownerInfo.wallet,
//         ownerPosition.nftMint,
//         positionNftAccount,
//         personalPosition,
//       ),
//     );

//     return {
//       signers: [],
//       instructions: ins,
//       address: {},
//     };
//   }

//   static makeSwapBaseInInstructions({
//     poolInfo,
//     ownerInfo,
//     inputMint,
//     amountIn,
//     amountOutMin,
//     sqrtPriceLimitX64,
//     remainingAccounts,
//   }: {
//     poolInfo: AmmV3PoolInfo;

//     ownerInfo: {
//       wallet: PublicKey;
//       tokenAccountA: PublicKey;
//       tokenAccountB: PublicKey;
//     };

//     inputMint: PublicKey;

//     amountIn: BN;
//     amountOutMin: BN;
//     sqrtPriceLimitX64: BN;

//     remainingAccounts: PublicKey[];
//   }): ReturnTypeMakeInstructions {
//     const isInputMintA = poolInfo.mintA.mint.equals(inputMint);
//     const ins = [
//       swapInstruction(
//         poolInfo.programId,
//         ownerInfo.wallet,

//         poolInfo.id,
//         poolInfo.ammConfig.id,

//         isInputMintA ? ownerInfo.tokenAccountA : ownerInfo.tokenAccountB,
//         isInputMintA ? ownerInfo.tokenAccountB : ownerInfo.tokenAccountA,

//         isInputMintA ? poolInfo.mintA.vault : poolInfo.mintB.vault,
//         isInputMintA ? poolInfo.mintB.vault : poolInfo.mintA.vault,

//         remainingAccounts,
//         poolInfo.observationId,
//         amountIn,
//         amountOutMin,
//         sqrtPriceLimitX64,
//         true,
//       ),
//     ];
//     return {
//       signers: [],
//       instructions: ins,
//       address: {},
//     };
//   }

//   static makeInitRewardInstructions({
//     poolInfo,
//     ownerInfo,
//     rewardInfo,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     ownerInfo: {
//       wallet: PublicKey;
//       tokenAccount: PublicKey;
//     };
//     rewardInfo: {
//       index: number;
//       mint: PublicKey;
//       vault: PublicKey;
//       openTime: number;
//       endTime: number;
//       emissionsPerSecondX64: BN;
//     };
//   }): ReturnTypeMakeInstructions {
//     const ins = [
//       initRewardInstruction(
//         poolInfo.programId,
//         ownerInfo.wallet,
//         poolInfo.id,
//         poolInfo.ammConfig.id,

//         ownerInfo.tokenAccount,
//         rewardInfo.mint,
//         rewardInfo.vault,

//         rewardInfo.index,
//         rewardInfo.openTime,
//         rewardInfo.endTime,
//         rewardInfo.emissionsPerSecondX64,
//       ),
//     ];
//     return {
//       signers: [],
//       instructions: ins,
//       address: {},
//     };
//   }

//   static makeSetRewardInstructions({
//     poolInfo,
//     ownerInfo,
//     rewardInfo,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     ownerInfo: {
//       wallet: PublicKey;
//       tokenAccount: PublicKey;
//     };
//     rewardInfo: {
//       index: number;
//       vault: PublicKey;
//       openTime: number;
//       endTime: number;
//       emissionsPerSecondX64: BN;
//     };
//   }): ReturnTypeMakeInstructions {
//     const ins = [
//       setRewardInstruction(
//         poolInfo.programId,
//         ownerInfo.wallet,
//         poolInfo.id,
//         poolInfo.ammConfig.id,

//         ownerInfo.tokenAccount,
//         rewardInfo.vault,

//         rewardInfo.index,
//         rewardInfo.openTime,
//         rewardInfo.endTime,
//         rewardInfo.emissionsPerSecondX64,
//       ),
//     ];
//     return {
//       signers: [],
//       instructions: ins,
//       address: {},
//     };
//   }

//   static makeCollectRewardInstructions({
//     poolInfo,
//     ownerInfo,
//     rewardInfo,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     ownerInfo: {
//       wallet: PublicKey;
//       tokenAccount: PublicKey;
//     };
//     rewardInfo: {
//       index: number;
//       vault: PublicKey;
//     };
//   }): ReturnTypeMakeInstructions {
//     const ins = [
//       collectRewardInstruction(
//         poolInfo.programId,
//         ownerInfo.wallet,
//         poolInfo.id,

//         ownerInfo.tokenAccount,
//         rewardInfo.vault,

//         rewardInfo.index,
//       ),
//     ];
//     return {
//       signers: [],
//       instructions: ins,
//       address: {},
//     };
//   }

//   // calculate
//   static getLiquidityAmountOutFromAmountIn({
//     poolInfo,
//     inputA,
//     tickLower,
//     tickUpper,
//     amount,
//     slippage,
//     add,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     inputA: boolean;
//     tickLower: number;
//     tickUpper: number;
//     amount: BN;
//     slippage: number;
//     add: boolean;
//   }): ReturnTypeGetLiquidityAmountOutFromAmountIn {
//     const sqrtPriceX64 = poolInfo.sqrtPriceX64;
//     const sqrtPriceX64A = SqrtPriceMath.getSqrtPriceX64FromTick(tickLower);
//     const sqrtPriceX64B = SqrtPriceMath.getSqrtPriceX64FromTick(tickUpper);

//     const coefficient = add ? 1 - slippage : 1 + slippage;
//     const _amount = amount.mul(new BN(Math.floor(coefficient * 1000000))).div(new BN(1000000));

//     let liquidity: BN;
//     if (sqrtPriceX64.lte(sqrtPriceX64A)) {
//       liquidity = inputA
//         ? LiquidityMath.getLiquidityFromTokenAmountA(sqrtPriceX64A, sqrtPriceX64B, _amount, !add)
//         : new BN(0);
//     } else if (sqrtPriceX64.lte(sqrtPriceX64B)) {
//       const liquidity0 = LiquidityMath.getLiquidityFromTokenAmountA(sqrtPriceX64, sqrtPriceX64B, _amount, !add);
//       const liquidity1 = LiquidityMath.getLiquidityFromTokenAmountB(sqrtPriceX64A, sqrtPriceX64, _amount);
//       liquidity = inputA ? liquidity0 : liquidity1;
//     } else {
//       liquidity = inputA
//         ? new BN(0)
//         : LiquidityMath.getLiquidityFromTokenAmountB(sqrtPriceX64A, sqrtPriceX64B, _amount);
//     }

//     const amountsSlippage = LiquidityMath.getAmountsFromLiquidityWithSlippage(
//       poolInfo.sqrtPriceX64,
//       sqrtPriceX64A,
//       sqrtPriceX64B,
//       liquidity,
//       add,
//       !add,
//       slippage,
//     );
//     const amounts = LiquidityMath.getAmountsFromLiquidity(
//       poolInfo.sqrtPriceX64,
//       sqrtPriceX64A,
//       sqrtPriceX64B,
//       liquidity,
//       !add,
//     );

//     return { liquidity, ...amountsSlippage, ...amounts };
//   }

//   static getAmountsFromLiquidity({
//     poolInfo,
//     ownerPosition,
//     liquidity,
//     slippage,
//     add,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     ownerPosition: AmmV3PoolPersonalPosition;
//     liquidity: BN;
//     slippage: number;
//     add: boolean;
//   }): ReturnTypeGetAmountsFromLiquidity {
//     const sqrtPriceX64A = SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickLower);
//     const sqrtPriceX64B = SqrtPriceMath.getSqrtPriceX64FromTick(ownerPosition.tickUpper);
//     return LiquidityMath.getAmountsFromLiquidityWithSlippage(
//       poolInfo.sqrtPriceX64,
//       sqrtPriceX64A,
//       sqrtPriceX64B,
//       liquidity,
//       add,
//       add,
//       slippage,
//     );
//   }

//   static getPriceAndTick({
//     poolInfo,
//     price,
//     baseIn,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     price: Decimal;
//     baseIn: boolean;
//   }): ReturnTypeGetPriceAndTick {
//     const _price = baseIn ? price : new Decimal(1).div(price);

//     const tick = TickMath.getTickWithPriceAndTickspacing(
//       _price,
//       poolInfo.ammConfig.tickSpacing,
//       poolInfo.mintA.decimals,
//       poolInfo.mintB.decimals,
//     );
//     const tickSqrtPriceX64 = SqrtPriceMath.getSqrtPriceX64FromTick(tick);
//     const tickPrice = SqrtPriceMath.sqrtPriceX64ToPrice(
//       tickSqrtPriceX64,
//       poolInfo.mintA.decimals,
//       poolInfo.mintB.decimals,
//     );

//     return baseIn ? { tick, price: tickPrice } : { tick, price: new Decimal(1).div(tickPrice) };
//   }

//   static async computeAmountOutFormat({
//     poolInfo,
//     tickArrayCache,
//     amountIn,
//     currencyOut,
//     slippage,
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     tickArrayCache: { [key: string]: TickArray };

//     amountIn: CurrencyAmount | TokenAmount;
//     currencyOut: Token | Currency;
//     slippage: Percent;
//   }): Promise<ReturnTypeComputeAmountOutFormat> {
//     const amountInIsTokenAmount = amountIn instanceof TokenAmount;
//     const inputMint = (amountInIsTokenAmount ? amountIn.token : Token.WSOL).mint;
//     const _amountIn = amountIn.raw;
//     const _slippage = slippage.numerator.toNumber() / slippage.denominator.toNumber();

//     const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee, remainingAccounts } =
//       await AmmV3.computeAmountOut({
//         poolInfo,
//         tickArrayCache,
//         baseMint: inputMint,
//         amountIn: _amountIn,
//         slippage: _slippage,
//       });

//     const _amountOut =
//       currencyOut instanceof Token
//         ? new TokenAmount(currencyOut, amountOut)
//         : new CurrencyAmount(currencyOut, amountOut);
//     const _minAmountOut =
//       currencyOut instanceof Token
//         ? new TokenAmount(currencyOut, minAmountOut)
//         : new CurrencyAmount(currencyOut, minAmountOut);
//     const _currentPrice = new Price(
//       amountInIsTokenAmount ? amountIn.token : amountIn.currency,
//       new BN(10).pow(new BN(20 + (amountInIsTokenAmount ? amountIn.token : amountIn.currency).decimals)),
//       currencyOut instanceof Token ? currencyOut : Token.WSOL,
//       currentPrice
//         .mul(new Decimal(10 ** (20 + (currencyOut instanceof Token ? currencyOut : Token.WSOL).decimals)))
//         .toFixed(0),
//     );
//     const _executionPrice = new Price(
//       amountInIsTokenAmount ? amountIn.token : amountIn.currency,
//       new BN(10).pow(new BN(20 + (amountInIsTokenAmount ? amountIn.token : amountIn.currency).decimals)),
//       currencyOut instanceof Token ? currencyOut : Token.WSOL,
//       executionPrice
//         .mul(new Decimal(10 ** (20 + (currencyOut instanceof Token ? currencyOut : Token.WSOL).decimals)))
//         .toFixed(0),
//     );
//     const _fee = amountInIsTokenAmount
//       ? new TokenAmount(amountIn.token, fee)
//       : new CurrencyAmount(amountIn.currency, fee);

//     return {
//       amountOut: _amountOut,
//       minAmountOut: _minAmountOut,
//       currentPrice: _currentPrice,
//       executionPrice: _executionPrice,
//       priceImpact,
//       fee: _fee,
//       remainingAccounts,
//     };
//   }

//   static async computeAmountOut({
//     poolInfo,
//     tickArrayCache,
//     baseMint,
//     amountIn,
//     slippage,
//     priceLimit = new Decimal(0),
//   }: {
//     poolInfo: AmmV3PoolInfo;
//     tickArrayCache: { [key: string]: TickArray };
//     baseMint: PublicKey;

//     amountIn: BN;
//     slippage: number;
//     priceLimit?: Decimal;
//   }): Promise<ReturnTypeComputeAmountOut> {
//     let sqrtPriceLimitX64: BN;
//     if (priceLimit.equals(new Decimal(0))) {
//       sqrtPriceLimitX64 = baseMint.equals(poolInfo.mintA.mint)
//         ? MIN_SQRT_PRICE_X64.add(ONE)
//         : MAX_SQRT_PRICE_X64.sub(ONE);
//     } else {
//       sqrtPriceLimitX64 = SqrtPriceMath.priceToSqrtPriceX64(
//         priceLimit,
//         poolInfo.mintA.decimals,
//         poolInfo.mintB.decimals,
//       );
//     }
//     const _amountIn = amountIn.mul(new BN(10 ** 6 - poolInfo.ammConfig.tradeFeeRate)).div(new BN(10 ** 6));
//     const fee = amountIn.sub(_amountIn);

//     const {
//       expectedAmountOut,
//       remainingAccounts,
//       executionPrice: _executionPriceX64,
//     } = await PoolUtils.getOutputAmountAndRemainAccounts(
//       poolInfo,
//       tickArrayCache,
//       baseMint,
//       _amountIn,
//       sqrtPriceLimitX64,
//     );

//     const _executionPrice = SqrtPriceMath.sqrtPriceX64ToPrice(
//       _executionPriceX64,
//       poolInfo.mintA.decimals,
//       poolInfo.mintB.decimals,
//     );
//     const executionPrice = baseMint.equals(poolInfo.mintA.mint) ? _executionPrice : new Decimal(1).div(_executionPrice);

//     const minAmountOut = expectedAmountOut
//       .mul(new BN(Math.floor((1 - slippage) * 10000000000)))
//       .div(new BN(10000000000));

//     const poolPrice = poolInfo.mintA.mint.equals(baseMint)
//       ? poolInfo.currentPrice
//       : new Decimal(1).div(poolInfo.currentPrice);
//     const priceImpact = new Percent(
//       parseInt(String(Math.abs(parseFloat(executionPrice.toFixed()) - parseFloat(poolPrice.toFixed())) * 1e9)),
//       parseInt(String(parseFloat(poolPrice.toFixed()) * 1e9)),
//     );

//     return {
//       amountOut: expectedAmountOut,
//       minAmountOut,
//       currentPrice: poolInfo.currentPrice,
//       executionPrice,
//       priceImpact,
//       fee,

//       remainingAccounts,
//     };
//   }

//   static async fetchMultiplePoolTickArrays({
//     connection,
//     poolKeys,
//     batchRequest,
//   }: {
//     connection: Connection;
//     poolKeys: AmmV3PoolInfo[];
//     batchRequest?: boolean;
//   }): Promise<ReturnTypeFetchMultiplePoolTickArrays> {
//     const tickArraysToPoolId = {};
//     const tickArrays: { pubkey: PublicKey }[] = [];
//     for (const itemPoolInfo of poolKeys) {
//       const tickArrayBitmap = TickUtils.mergeTickArrayBitmap(itemPoolInfo.tickArrayBitmap);
//       const currentTickArrayStartIndex = TickUtils.getTickArrayStartIndexByTick(
//         itemPoolInfo.tickCurrent,
//         itemPoolInfo.tickSpacing,
//       );

//       const startIndexArray = TickUtils.getInitializedTickArrayInRange(
//         tickArrayBitmap,
//         itemPoolInfo.tickSpacing,
//         currentTickArrayStartIndex,
//         Math.floor(FETCH_TICKARRAY_COUNT / 2),
//       );
//       for (const itemIndex of startIndexArray) {
//         const { publicKey: tickArrayAddress } = await getPdaTickArrayAddress(
//           itemPoolInfo.programId,
//           itemPoolInfo.id,
//           itemIndex,
//         );
//         tickArrays.push({ pubkey: tickArrayAddress });
//         tickArraysToPoolId[tickArrayAddress.toString()] = itemPoolInfo.id;
//       }
//     }

//     const fetchedTickArrays = await getMultipleAccountsInfoWithCustomFlags(connection, tickArrays, { batchRequest });

//     const tickArrayCache: ReturnTypeFetchMultiplePoolTickArrays = {};

//     for (const itemAccountInfo of fetchedTickArrays) {
//       if (!itemAccountInfo.accountInfo) continue;
//       const poolId = tickArraysToPoolId[itemAccountInfo.pubkey.toString()];
//       if (!poolId) continue;
//       if (tickArrayCache[poolId] === undefined) tickArrayCache[poolId] = {};

//       const accountLayoutData = TickArrayLayout.decode(itemAccountInfo.accountInfo.data);

//       tickArrayCache[poolId][accountLayoutData.startTickIndex] = {
//         ...accountLayoutData,
//         address: itemAccountInfo.pubkey,
//       };
//     }
//     return tickArrayCache;
//   }
// }
