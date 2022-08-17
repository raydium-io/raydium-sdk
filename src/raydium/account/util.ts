import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AccountInfo,
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  RpcResponseAndContext,
  Signer,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";

import { BigNumberish, createLogger, parseBigNumberish, validateAndParsePublicKey } from "../../common";
import { TOKEN_WSOL } from "../token/constant";

import { splAccountLayout } from "./layout";
import { TokenAccount, TokenAccountRaw } from "./types";

const logger = createLogger("Raydium.Util");

export interface ParseTokenAccount {
  solAccountResp?: AccountInfo<Buffer> | null;
  tokenAccountResp: RpcResponseAndContext<
    Array<{
      pubkey: PublicKey;
      account: AccountInfo<Buffer>;
    }>
  >;
}

export function parseTokenAccountResp({ solAccountResp, tokenAccountResp }: ParseTokenAccount): {
  tokenAccounts: TokenAccount[];
  tokenAccountRawInfos: TokenAccountRaw[];
} {
  const tokenAccounts: TokenAccount[] = [];
  const tokenAccountRawInfos: TokenAccountRaw[] = [];

  for (const { pubkey, account } of tokenAccountResp.value) {
    if (account.data.length !== splAccountLayout.span) {
      logger.error("invalid token account layout length", "publicKey", pubkey.toBase58());
      throw new Error("invalid token account layout length");
    }

    const accountInfo = splAccountLayout.decode(account.data);
    const { mint, amount } = accountInfo;

    tokenAccounts.push({
      publicKey: pubkey,
      mint,
      amount,
      isNative: false,
    });
    tokenAccountRawInfos.push({ pubkey, accountInfo });
  }

  if (solAccountResp) {
    tokenAccounts.push({
      amount: new BN(solAccountResp.lamports),
      isNative: true,
    });
  }

  return {
    tokenAccounts,
    tokenAccountRawInfos,
  };
}

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
}
export async function createWrappedNativeAccountInstructions(params: CreateWrappedTokenAccount): Promise<{
  signer: Signer;
  instructions: TransactionInstruction[];
}> {
  const { connection, amount, commitment, payer, owner } = params;

  const balanceNeeded = await connection.getMinimumBalanceForRentExemption(splAccountLayout.span, commitment);
  const lamports = parseBigNumberish(amount).add(new BN(balanceNeeded));
  const newAccount = Keypair.generate();

  return {
    signer: newAccount,
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
  };
}
