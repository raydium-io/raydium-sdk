import { PublicKey, TransactionInstruction, Keypair } from '@solana/web3.js';
import { a2 as RewardInfoKey, a1 as FarmRewardInfoConfig } from '../../type-9c271374.js';
import 'bn.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../../bignumber-2daa5944.js';
import '../../module/token.js';
import '../../common/pubKey.js';
import '../token/type.js';
import '../../common/logger.js';
import '../account/types.js';
import '../account/layout.js';

declare function createAssociatedLedgerAccountInstruction(params: {
    version: number;
    id: PublicKey;
    programId: PublicKey;
    ledger: PublicKey;
    owner: PublicKey;
}): Promise<TransactionInstruction>;
interface CreateFarmInstruction {
    farmKeyPair: Keypair;
    farmAuthority: PublicKey;
    lpVault: PublicKey;
    lpMint: PublicKey;
    lockVault: PublicKey;
    lockMint: PublicKey;
    lockUserAccount?: PublicKey;
    programId: PublicKey;
    owner: PublicKey;
    rewardInfo: RewardInfoKey[];
    rewardInfoConfig: FarmRewardInfoConfig[];
    nonce: number;
}
declare function makeCreateFarmInstruction(params: CreateFarmInstruction): TransactionInstruction;

export { createAssociatedLedgerAccountInstruction, makeCreateFarmInstruction };
