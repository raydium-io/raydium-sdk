import { Token, TOKEN_PROGRAM_ID, u64 as _u64 } from "@solana/spl-token";
import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";

import { BigNumberish, parseBigNumberish, validateAndParsePublicKey } from "../../common";
import { AddInstructionParam } from "../../common/txTool";
import { u64 } from "../../marshmallow";
import { TOKEN_WSOL } from "../token/constant";

import { splAccountLayout } from "./layout";

export function initTokenAccountInstruction(params: {
  mint: PublicKey;
  tokenAccount: PublicKey;
  owner: PublicKey;
}): TransactionInstruction {
  const { mint, tokenAccount, owner } = params;
  return Token.createInitAccountInstruction(TOKEN_PROGRAM_ID, mint, tokenAccount, owner);
}

export function closeAccountInstruction(params: {
  tokenAccount: PublicKey;
  payer: PublicKey;
  multiSigners?: Signer[];
  owner: PublicKey;
}): TransactionInstruction {
  const { tokenAccount, payer, multiSigners = [], owner } = params;
  return Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, tokenAccount, payer, owner, multiSigners);
}

interface CreateWrappedTokenAccount {
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
export async function createWrappedNativeAccountInstructions(
  params: CreateWrappedTokenAccount,
): Promise<AddInstructionParam> {
  const { connection, amount, commitment, payer, owner, skipCloseAccount } = params;

  const balanceNeeded = await connection.getMinimumBalanceForRentExemption(splAccountLayout.span, commitment);
  const lamports = parseBigNumberish(amount).add(new BN(balanceNeeded));
  const newAccount = Keypair.generate();

  return {
    signers: [newAccount],
    instructions: [
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: newAccount.publicKey,
        lamports: lamports.toNumber(),
        space: splAccountLayout.span,
        programId: TOKEN_PROGRAM_ID,
      }),
      initTokenAccountInstruction({
        mint: validateAndParsePublicKey(TOKEN_WSOL.mint),
        tokenAccount: newAccount.publicKey,
        owner,
      }),
    ],
    endInstructions: skipCloseAccount
      ? []
      : [
          closeAccountInstruction({
            tokenAccount: newAccount.publicKey,
            payer,
            owner,
          }),
        ],
  };
}

export function makeTransferInstruction({
  source,
  destination,
  owner,
  amount,
  multiSigners = [],
}: {
  source: PublicKey;
  destination: PublicKey;
  owner: PublicKey;
  amount: BigNumberish;
  multiSigners?: Signer[];
}): TransactionInstruction {
  const LAYOUT = u64("amount");
  const data = Buffer.alloc(LAYOUT.span);
  LAYOUT.encode(parseBigNumberish(amount), data);

  return Token.createTransferInstruction(
    TOKEN_PROGRAM_ID,
    source,
    destination,
    owner,
    multiSigners,
    _u64.fromBuffer(data),
  );
}
