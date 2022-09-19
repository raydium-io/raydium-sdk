import { TransactionInstruction, Signer, Transaction, Connection, PublicKey } from '@solana/web3.js';
import { au as SignAllTransactions } from '../type-bcca4bc0.js';
import { Owner } from './owner.js';
import 'bn.js';
import '../marshmallow/index.js';
import '../marshmallow/buffer-layout.js';
import '../bignumber-2daa5944.js';
import '../module/token.js';
import './pubKey.js';
import '../raydium/token/type.js';
import './logger.js';
import '../raydium/account/types.js';
import '../raydium/account/layout.js';

interface TxBuilderInit {
    connection: Connection;
    feePayer: PublicKey;
    owner?: Owner;
    signAllTransactions?: SignAllTransactions;
}
interface AddInstructionParam {
    instructions?: TransactionInstruction[];
    endInstructions?: TransactionInstruction[];
    signers?: Signer[];
}
interface TxBuildData {
    transaction: Transaction;
    signers: Signer[];
    execute: () => Promise<string>;
    extInfo: Record<string, any>;
}
interface MultiTxBuildData {
    transactions: Transaction[];
    signers: Signer[][];
    execute: () => Promise<string[]>;
    extInfo: Record<string, any>;
}
declare class TxBuilder {
    private connection;
    private owner?;
    private instructions;
    private endInstructions;
    private signers;
    private feePayer;
    private signAllTransactions?;
    constructor(params: TxBuilderInit);
    get AllTxData(): {
        instructions: TransactionInstruction[];
        endInstructions: TransactionInstruction[];
        signers: Signer[];
    };
    get allInstructions(): TransactionInstruction[];
    addInstruction({ instructions, endInstructions, signers }: AddInstructionParam): TxBuilder;
    build(extInfo?: Record<string, any>): TxBuildData;
    buildMultiTx(params: {
        extraPreBuildData?: TxBuildData[];
        extInfo?: Record<string, any>;
    }): MultiTxBuildData;
}
declare function getRecentBlockHash(connection: Connection): Promise<string>;
/**
 * Forecast transaction size
 */
declare function forecastTransactionSize(instructions: TransactionInstruction[], signers: PublicKey[]): number;
/**
 * Simulates multiple instruction
 */
declare function simulateMultipleInstruction(connection: Connection, instructions: TransactionInstruction[], keyword: string): Promise<any>;
declare function parseSimulateLogToJson(log: string, keyword: string): any;
declare function parseSimulateValue(log: string, key: string): any;
interface ProgramAddress {
    publicKey: PublicKey;
    nonce: number;
}
declare function findProgramAddress(seeds: Array<Buffer | Uint8Array>, programId: PublicKey): Promise<ProgramAddress>;

export { AddInstructionParam, MultiTxBuildData, ProgramAddress, TxBuildData, TxBuilder, findProgramAddress, forecastTransactionSize, getRecentBlockHash, parseSimulateLogToJson, parseSimulateValue, simulateMultipleInstruction };
