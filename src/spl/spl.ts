import { Token as _Token } from "@solana/spl-token";
import {
  Commitment, Connection, Keypair, PublicKey, Signer, SystemProgram, TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, validateAndParsePublicKey,
} from "../common";
import { BigNumberIsh, parseBigNumberIsh } from "../entity";
import { WSOL } from "../token";
import { SPL_ACCOUNT_LAYOUT } from "./layout";

export class Spl {
  static getAssociatedTokenAccount({ mint, owner }: { mint: PublicKey; owner: PublicKey }) {
    return _Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, mint, owner);
  }

  static makeCreateAssociatedTokenAccountInstruction({
    mint,
    associatedAccount,
    owner,
    payer,
  }: {
    mint: PublicKey;
    associatedAccount: PublicKey;
    owner: PublicKey;
    payer: PublicKey;
  }) {
    return _Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      associatedAccount,
      owner,
      payer,
    );
  }

  // https://github.com/solana-labs/solana-program-library/blob/master/token/js/client/token.js
  static async makeCreateWrappedNativeAccountInstructions({
    connection,
    owner,
    payer,
    amount,
    commitment,
  }: {
    connection: Connection;
    owner: PublicKey;
    payer: PublicKey;
    amount: BigNumberIsh;
    commitment?: Commitment;
  }) {
    const instructions: TransactionInstruction[] = [];

    // Allocate memory for the account
    const balanceNeeded = await connection.getMinimumBalanceForRentExemption(SPL_ACCOUNT_LAYOUT.span, commitment);

    // Create a new account
    const newAccount = Keypair.generate();
    instructions.push(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: newAccount.publicKey,
        lamports: balanceNeeded,
        space: SPL_ACCOUNT_LAYOUT.span,
        programId: TOKEN_PROGRAM_ID,
      }),
    );

    // Send lamports to it (these will be wrapped into native tokens by the token program)
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: newAccount.publicKey,
        lamports: parseBigNumberIsh(amount).toNumber(),
      }),
    );

    // Assign the new account to the native token mint.
    // the account will be initialized with a balance equal to the native token balance.
    // (i.e. amount)
    instructions.push(
      this.makeInitAccountInstruction({
        mint: validateAndParsePublicKey(WSOL.mint),
        tokenAccount: newAccount.publicKey,
        owner,
      }),
    );

    return { newAccount, instructions };
  }

  static makeInitMintInstruction({
    mint,
    decimals,
    mintAuthority,
    freezeAuthority = null,
  }: {
    mint: PublicKey;
    decimals: number;
    mintAuthority: PublicKey;
    freezeAuthority?: PublicKey | null;
  }) {
    return _Token.createInitMintInstruction(TOKEN_PROGRAM_ID, mint, decimals, mintAuthority, freezeAuthority);
  }

  static makeMintToInstruction({
    mint,
    dest,
    authority,
    amount,
    multiSigners = [],
  }: {
    mint: PublicKey;
    dest: PublicKey;
    authority: PublicKey;
    amount: BigNumberIsh;
    multiSigners?: Signer[];
  }) {
    return _Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mint,
      dest,
      authority,
      multiSigners,
      parseBigNumberIsh(amount),
    );
  }

  static makeInitAccountInstruction({
    mint,
    tokenAccount,
    owner,
  }: {
    mint: PublicKey;
    tokenAccount: PublicKey;
    owner: PublicKey;
  }) {
    return _Token.createInitAccountInstruction(TOKEN_PROGRAM_ID, mint, tokenAccount, owner);
  }

  static makeTransferInstruction({
    source,
    destination,
    owner,
    amount,
    multiSigners = [],
  }: {
    source: PublicKey;
    destination: PublicKey;
    owner: PublicKey;
    amount: BigNumberIsh;
    multiSigners?: Signer[];
  }) {
    return _Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      source,
      destination,
      owner,
      multiSigners,
      parseBigNumberIsh(amount),
    );
  }

  static makeCloseAccountInstruction({
    tokenAccount,
    owner,
    payer,
    multiSigners = [],
  }: {
    tokenAccount: PublicKey;
    owner: PublicKey;
    payer: PublicKey;
    multiSigners?: Signer[];
  }) {
    return _Token.createCloseAccountInstruction(TOKEN_PROGRAM_ID, tokenAccount, payer, owner, multiSigners);
  }
}
