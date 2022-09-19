import { TransactionInstruction, PublicKey } from '@solana/web3.js';
import { LiquiditySwapInstructionParams, LiquidityPoolKeys, LiquiditySwapFixedInInstructionParamsV4, LiquiditySwapFixedOutInstructionParamsV4, LiquidityAssociatedPoolKeys, LiquidityInitPoolInstructionParams, LiquidityAddInstructionParams, LiquidityRemoveInstructionParams } from './type.js';
import 'bn.js';
import '../../type-665453b6.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../../bignumber-cbebe552.js';
import '../../module/token.js';
import '../../common/pubKey.js';
import '../token/type.js';
import '../../common/logger.js';
import 'pino';
import '../account/types.js';
import '../account/layout.js';
import '../../common/accountInfo.js';

declare function makeAMMSwapInstruction(params: LiquiditySwapInstructionParams): TransactionInstruction;
declare function makeSimulatePoolInfoInstruction(poolKeys: LiquidityPoolKeys): TransactionInstruction;
declare function makeSwapFixedInInstruction({ poolKeys, userKeys, amountIn, minAmountOut }: LiquiditySwapFixedInInstructionParamsV4, version: number): TransactionInstruction;
declare function makeSwapFixedOutInstruction({ poolKeys, userKeys, maxAmountIn, amountOut }: LiquiditySwapFixedOutInstructionParamsV4, version: number): TransactionInstruction;
declare function makeCreatePoolInstruction(params: LiquidityAssociatedPoolKeys & {
    owner: PublicKey;
}): TransactionInstruction;
declare function makeInitPoolInstruction(params: LiquidityInitPoolInstructionParams): TransactionInstruction;
declare function makeAddLiquidityInstruction(params: LiquidityAddInstructionParams): TransactionInstruction;
declare function makeRemoveLiquidityInstruction(params: LiquidityRemoveInstructionParams): TransactionInstruction;

export { makeAMMSwapInstruction, makeAddLiquidityInstruction, makeCreatePoolInstruction, makeInitPoolInstruction, makeRemoveLiquidityInstruction, makeSimulatePoolInfoInstruction, makeSwapFixedInInstruction, makeSwapFixedOutInstruction };
