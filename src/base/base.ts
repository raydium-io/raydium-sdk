import { Connection, PublicKey, Signer, Transaction, TransactionInstruction } from "@solana/web3.js";

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

export interface UnsignedTransactionAndSigners {
  transaction: Transaction;
  signers: Signer[];
}

export class Base {
  static async _selectTokenAccount(params: SelectTokenAccountParams) {
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

    const ata = await Spl.getAssociatedTokenAccount({ mint, owner });

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

    const ata = await Spl.getAssociatedTokenAccount({ mint, owner });

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
}
