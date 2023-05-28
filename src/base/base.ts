import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection, Keypair, PublicKey, Signer, SystemProgram, Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import { BigNumberish, Token } from '../entity';
import { Spl, SplAccount } from '../spl';

import { InstructionType } from './type';

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
  frontInstructionsType: InstructionType[];
  endInstructionsType?: InstructionType[];
  signers: Signer[];
  bypassAssociatedCheck: boolean;

  checkCreateATAOwner: boolean // if owner check error and associatedOnly = true -> then throw Error else out notATA
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

    frontInstructionsType: InstructionType[];
    endInstructionsType?: InstructionType[];
  }

  associatedOnly: boolean

  checkCreateATAOwner: boolean // if owner check error and associatedOnly = true -> then throw Error else out notATA
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
      frontInstructionsType,
      endInstructionsType,
      checkCreateATAOwner,
    } = params;

    const ata = Spl.getAssociatedTokenAccount({ mint, owner });

    if (Token.WSOL.mint.equals(mint)) {
      const newTokenAccount = await Spl.insertCreateWrappedNativeAccount({
        connection,
        owner,
        payer,
        instructions: frontInstructions,
        instructionsType: frontInstructionsType,
        signers,
        amount,
      });
      // if no endInstructions provide, no need to close
      if (endInstructions) {
        endInstructions.push(Spl.makeCloseAccountInstruction({ tokenAccount: newTokenAccount, owner, payer, instructionsType: endInstructionsType ?? [] }));
      }

      return newTokenAccount;
    } else if (!tokenAccount || (side === "out" && !ata.equals(tokenAccount) && !bypassAssociatedCheck)) {
      const _createATAIns = Spl.makeCreateAssociatedTokenAccountInstruction({
        mint,
        associatedAccount: ata,
        owner,
        payer,
        instructionsType: frontInstructionsType,
      })
      if (checkCreateATAOwner) {
        const ataInfo = await connection.getAccountInfo(ata)
        if (ataInfo === null) {
          frontInstructions.push(_createATAIns);
        } else if (ataInfo.owner.equals(TOKEN_PROGRAM_ID) && AccountLayout.decode(ataInfo.data).mint.equals(mint) && AccountLayout.decode(ataInfo.data).owner.equals(owner)) { 
          /* empty */ 
        } else {
          throw Error(`create ata check error -> mint: ${mint.toString()}, ata: ${ata.toString()}`)
        }
      } else {
        frontInstructions.push(_createATAIns);
      }
      return ata;
    }

    return tokenAccount;
  }

  static async _selectOrCreateTokenAccount<T extends SelectOrCreateTokenAccountParams>(params: T): Promise<T['createInfo'] extends undefined ? PublicKey | undefined: PublicKey> {
    const { mint, tokenAccounts, createInfo, associatedOnly, owner, checkCreateATAOwner } = params
    const ata = Spl.getAssociatedTokenAccount({ mint, owner });
    const accounts = tokenAccounts.filter((i) => i.accountInfo.mint.equals(mint) && (!associatedOnly || i.pubkey.equals(ata))).sort((a, b) => (a.accountInfo.amount.lt(b.accountInfo.amount) ? 1 : -1))
    // find token or don't need create
    if (createInfo === undefined || accounts.length > 0) {
      return accounts.length > 0 ? accounts[0].pubkey : undefined as any
    }

    if (associatedOnly) {
      const _createATAIns = Spl.makeCreateAssociatedTokenAccountInstruction({
        mint,
        associatedAccount: ata,
        owner,
        payer: createInfo.payer,
        instructionsType: createInfo.frontInstructionsType,
      })
      if (checkCreateATAOwner) {
        const ataInfo = await createInfo.connection.getAccountInfo(ata)
        if (ataInfo === null) {
          createInfo.frontInstructions.push(_createATAIns);
        } else if (ataInfo.owner.equals(TOKEN_PROGRAM_ID) && AccountLayout.decode(ataInfo.data).mint.equals(mint) && AccountLayout.decode(ataInfo.data).owner.equals(owner)) { 
          /* empty */ 
        } else {
          throw Error(`create ata check error -> mint: ${mint.toString()}, ata: ${ata.toString()}`)
        }
      } else {
        createInfo.frontInstructions.push(_createATAIns);
      }

      if (mint.equals(Token.WSOL.mint) && createInfo.amount) {
        const newTokenAccount = await Spl.insertCreateWrappedNativeAccount({
          connection: createInfo.connection,
          owner,
          payer: createInfo.payer,
          instructions: createInfo.frontInstructions,
          instructionsType: createInfo.frontInstructionsType,
          signers: createInfo.signers,
          amount: createInfo.amount ?? 0,
        });

        (createInfo.endInstructions ?? []).push(Spl.makeCloseAccountInstruction({ tokenAccount: newTokenAccount, owner, payer: createInfo.payer, instructionsType: createInfo.endInstructionsType ?? [] }));

        if (createInfo.amount) {
          createInfo.frontInstructions.push(
            Spl.makeTransferInstruction({
              source: newTokenAccount,
              destination: ata,
              owner,
              amount: createInfo.amount,
              instructionsType: createInfo.frontInstructionsType
            })
          )
        }
      }

      (createInfo.endInstructions ?? []).push(Spl.makeCloseAccountInstruction({ tokenAccount: ata, owner, payer: createInfo.payer, instructionsType: createInfo.endInstructionsType ?? [] }));

      return ata
    } else {
      if (mint.equals(Token.WSOL.mint)) {
        const newTokenAccount = await Spl.insertCreateWrappedNativeAccount({
          connection: createInfo.connection,
          owner,
          payer: createInfo.payer,
          instructions: createInfo.frontInstructions,
          instructionsType: createInfo.frontInstructionsType,
          signers: createInfo.signers,
          amount: createInfo.amount ?? 0,
        });
        (createInfo.endInstructions ?? []).push(Spl.makeCloseAccountInstruction({ tokenAccount: newTokenAccount, owner, payer: createInfo.payer , instructionsType: createInfo.endInstructionsType ?? []}));
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
        createInfo.frontInstructionsType.push(InstructionType.createAccount, InstructionType.initAccount)
        createInfo.signers.push(newTokenAccount);
        (createInfo.endInstructions ?? []).push(Spl.makeCloseAccountInstruction({ tokenAccount: newTokenAccount.publicKey, owner, payer: createInfo.payer , instructionsType: createInfo.endInstructionsType ?? []}));
        return newTokenAccount.publicKey
      }
    }
  }
}
