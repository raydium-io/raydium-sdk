import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { createLogger } from "../../common/logger";
import { accountMeta, commonSystemAccountMeta, SOLMint } from "../../common/pubKey";

import { associatedLedgerAccountLayout, farmRewardLayout } from "./layout";
import { FarmRewardInfoConfig, RewardInfoKey } from "./type";

const logger = createLogger("Raydium_farm_instruction");

export async function createAssociatedLedgerAccountInstruction(params: {
  version: number;
  id: PublicKey;
  programId: PublicKey;
  ledger: PublicKey;
  owner: PublicKey;
}): Promise<TransactionInstruction> {
  const { version, id, ledger, programId, owner } = params;
  const instruction = { 3: 9, 5: 10 }[version];
  if (!instruction) logger.logWithError(`invalid farm pool version: ${version}`);

  const data = Buffer.alloc(associatedLedgerAccountLayout.span);
  associatedLedgerAccountLayout.encode(
    {
      instruction: instruction!,
    },
    data,
  );

  const keys = [
    accountMeta({ pubkey: id }),
    accountMeta({ pubkey: ledger }),
    accountMeta({ pubkey: owner, isWritable: false }),
    accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
    accountMeta({ pubkey: SYSVAR_RENT_PUBKEY, isWritable: false }),
  ];

  return new TransactionInstruction({
    programId,
    keys,
    data,
  });
}

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
export function makeCreateFarmInstruction(params: CreateFarmInstruction): TransactionInstruction {
  const data = Buffer.alloc(farmRewardLayout.span);
  farmRewardLayout.encode(
    {
      instruction: 0,
      nonce: new BN(params.nonce),
      rewardTimeInfo: params.rewardInfoConfig,
    },
    data,
  );

  const keys = [
    ...commonSystemAccountMeta,
    accountMeta({ pubkey: params.farmKeyPair.publicKey }),
    accountMeta({ pubkey: params.farmAuthority, isWritable: false }),
    accountMeta({ pubkey: params.lpVault }),
    accountMeta({ pubkey: params.lpMint, isWritable: false }),
    accountMeta({ pubkey: params.lockVault }),
    accountMeta({ pubkey: params.lockMint, isWritable: false }),
    accountMeta({ pubkey: params.lockUserAccount ?? SOLMint }),
    accountMeta({ pubkey: params.owner, isWritable: false, isSigner: true }),
  ];

  for (const item of params.rewardInfo) {
    keys.push(
      ...[
        accountMeta({ pubkey: item.rewardMint, isWritable: false }),
        accountMeta({ pubkey: item.rewardVault }),
        accountMeta({ pubkey: item.userRewardToken }),
      ],
    );
  }

  return new TransactionInstruction({ programId: params.programId, keys, data });
}
