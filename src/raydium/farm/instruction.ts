import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction } from "@solana/web3.js";

import { createLogger } from "../../common/logger";
import { accountMeta } from "../../common/pubKey";

import { associatedLedgerAccountLayout } from "./layout";

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
