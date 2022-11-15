import { AccountLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Connection, Keypair, PublicKey, Signer, SystemProgram, Transaction, TransactionInstruction,
} from "@solana/web3.js";

import { BigNumberish, Token } from "../entity";
import { Spl, SplAccount } from "../spl";

export interface TokenAccount {
  pubkey: PublicKey;
  accountInfo: SplAccount;
}

export interface SelectTokenAccountParams {
  tokenAccounts: TokenAccount[];
  mint: PublicKey;
  owner: PublicKey;
  config?: { associatedOnly?: boolean };
}

export interface HandleTokenAccountParams {
  connection: Connection;
  side: "in" | "out";
  amount: BigNumberish;
  mint: PublicKey;
  tokenAccount: PublicKey | null;
  owner: PublicKey;
  payer?: PublicKey;
  frontInstructions: TransactionInstruction[];
  endInstructions?: TransactionInstruction[];
  signers: Signer[];
  bypassAssociatedCheck: boolean;
}

export interface SelectOrCreateTokenAccountParams {
  mint: PublicKey,
  tokenAccounts: TokenAccount[]

  owner: PublicKey

  createInfo?: {
    connection: Connection,
    payer: PublicKey
    amount?: BigNumberish

    frontInstructions: TransactionInstruction[];
    endInstructions?: TransactionInstruction[];
    signers: Signer[];
  }

  associatedOnly: boolean
}

export interface UnsignedTransactionAndSigners {
  transaction: Transaction;
  signers: Signer[];
}

export class Base {
  static _selectTokenAccount(params: SelectTokenAccountParams) {
    const { tokenAccounts, mint, owner, config } = params;

    const { associatedOnly } = {
      // default
      ...{ associatedOnly: true },
      // custom
      ...config,
    };

    const _tokenAccounts = tokenAccounts
      // filter by mint
      .filter(({ accountInfo }) => accountInfo.mint.equals(mint))
      // sort by balance
      .sort((a, b) => (a.accountInfo.amount.lt(b.accountInfo.amount) ? 1 : -1));

    const ata = Spl.getAssociatedTokenAccount({ mint, owner });

    for (const tokenAccount of _tokenAccounts) {
      const { pubkey } = tokenAccount;

      if (associatedOnly) {
        // return ata only
        if (ata.equals(pubkey)) return pubkey;
      } else {
        // return the first account
        return pubkey;
      }
    }

    return null;
  }

  static async _handleTokenAccount(params: HandleTokenAccountParams) {
    const {
      connection,
      side,
      amount,
      mint,
      tokenAccount,
      owner,
      payer = owner,
      frontInstructions,
      endInstructions,
      signers,
      bypassAssociatedCheck,
    } = params;

    const ata = Spl.getAssociatedTokenAccount({ mint, owner });

    if (Token.WSOL.mint.equals(mint)) {
      const newTokenAccount = await Spl.insertCreateWrappedNativeAccountInstructions({
        connection,
        owner,
        payer,
        instructions: frontInstructions,
        signers,
        amount,
      });
      // if no endInstructions provide, no need to close
      if (endInstructions) {
        endInstructions.push(Spl.makeCloseAccountInstruction({ tokenAccount: newTokenAccount, owner, payer }));
      }

      return newTokenAccount;
    } else if (!tokenAccount || (side === "out" && !ata.equals(tokenAccount) && !bypassAssociatedCheck)) {
      frontInstructions.push(
        Spl.makeCreateAssociatedTokenAccountInstruction({
          mint,
          associatedAccount: ata,
          owner,
          payer,
        }),
      );

      return ata;
    }

    return tokenAccount;
  }

  static async _selectOrCreateTokenAccount(params: SelectOrCreateTokenAccountParams) {
    const { mint, tokenAccounts, createInfo, associatedOnly, owner } = params
    const ata = Spl.getAssociatedTokenAccount({ mint, owner });
    const accounts = tokenAccounts.filter((i) => i.accountInfo.mint.equals(mint) && (!associatedOnly || i.pubkey.equals(ata))).sort((a, b) => (a.accountInfo.amount.lt(b.accountInfo.amount) ? 1 : -1))
    // find token or don't need create
    if (createInfo === undefined || accounts.length > 0) {
      return accounts.length > 0 ? accounts[0].pubkey : undefined
    }

    if (associatedOnly) {
      createInfo.frontInstructions.push(
        Spl.makeCreateAssociatedTokenAccountInstruction({
          mint,
          associatedAccount: ata,
          owner,
          payer: createInfo.payer,
        }),
      );

      if (mint.equals(Token.WSOL.mint)) {
        const newTokenAccount = await Spl.insertCreateWrappedNativeAccountInstructions({
          connection: createInfo.connection,
          owner,
          payer: createInfo.payer,
          instructions: createInfo.frontInstructions,
          signers: createInfo.signers,
          amount: createInfo.amount ?? 0,
        });
        if (createInfo.endInstructions) {
          createInfo.endInstructions.push(Spl.makeCloseAccountInstruction({ tokenAccount: newTokenAccount, owner, payer: createInfo.payer }));
        }

        if (createInfo.amount) {
          createInfo.frontInstructions.push(
            Spl.makeTransferInstruction({
              source: newTokenAccount,
              destination: ata,
              owner,
              amount: createInfo.amount,
            })
          )
        }
      }

      if (createInfo.endInstructions) {
        createInfo.endInstructions.push(Spl.makeCloseAccountInstruction({ tokenAccount: ata, owner, payer: createInfo.payer }));
      }

      return ata
    } else {
      if (mint.equals(Token.WSOL.mint)) {
        const newTokenAccount = await Spl.insertCreateWrappedNativeAccountInstructions({
          connection: createInfo.connection,
          owner,
          payer: createInfo.payer,
          instructions: createInfo.frontInstructions,
          signers: createInfo.signers,
          amount: createInfo.amount ?? 0,
        });
        if (createInfo.endInstructions) {
          createInfo.endInstructions.push(Spl.makeCloseAccountInstruction({ tokenAccount: newTokenAccount, owner, payer: createInfo.payer }));
        }
        return newTokenAccount
      } else {
        const newTokenAccount = Keypair.generate()
        const balanceNeeded = await createInfo.connection.getMinimumBalanceForRentExemption(AccountLayout.span)

        const createAccountIns = SystemProgram.createAccount({
          fromPubkey: owner,
          newAccountPubkey: newTokenAccount.publicKey,
          lamports: balanceNeeded,
          space: AccountLayout.span,
          programId: TOKEN_PROGRAM_ID,
        })

        const initAccountIns = Spl.createInitAccountInstruction(
          TOKEN_PROGRAM_ID,
          mint,
          newTokenAccount.publicKey,
          owner,
        )
        createInfo.frontInstructions.push(createAccountIns, initAccountIns)
        createInfo.signers.push(newTokenAccount)
        if (createInfo.endInstructions) {
          createInfo.endInstructions.push(Spl.makeCloseAccountInstruction({ tokenAccount: newTokenAccount.publicKey, owner, payer: createInfo.payer }))
        }
        return newTokenAccount.publicKey
      }
    }
  }
}
