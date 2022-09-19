import { PublicKey, TransactionInstruction, Signer, Connection, Commitment } from '@solana/web3.js';
import { i as BigNumberish } from '../../bignumber-2daa5944.js';
import { AddInstructionParam } from '../../common/txTool.js';
import 'bn.js';
import '../../module/token.js';
import '../../common/pubKey.js';
import '../token/type.js';
import '../../common/logger.js';
import '../../type-9c271374.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import './types.js';
import './layout.js';
import '../../common/owner.js';

declare function initTokenAccountInstruction(params: {
    mint: PublicKey;
    tokenAccount: PublicKey;
    owner: PublicKey;
}): TransactionInstruction;
declare function closeAccountInstruction(params: {
    tokenAccount: PublicKey;
    payer: PublicKey;
    multiSigners?: Signer[];
    owner: PublicKey;
}): TransactionInstruction;
interface CreateWSolTokenAccount {
    connection: Connection;
    payer: PublicKey;
    owner: PublicKey;
    amount: BigNumberish;
    commitment?: Commitment;
    skipCloseAccount?: boolean;
}
/**
 * WrappedNative account = wsol account
 */
declare function createWSolAccountInstructions(params: CreateWSolTokenAccount): Promise<AddInstructionParam>;
declare function makeTransferInstruction({ source, destination, owner, amount, multiSigners, }: {
    source: PublicKey;
    destination: PublicKey;
    owner: PublicKey;
    amount: BigNumberish;
    multiSigners?: Signer[];
}): TransactionInstruction;

export { closeAccountInstruction, createWSolAccountInstructions, initTokenAccountInstruction, makeTransferInstruction };
