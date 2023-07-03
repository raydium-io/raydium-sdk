import {
  createAssociatedTokenAccountInstruction, createCloseAccountInstruction, createInitializeAccountInstruction,
  createInitializeMintInstruction, createMintToInstruction, createTransferInstruction,
} from "@solana/spl-token";
import {
  Commitment, Connection, Keypair, PublicKey, Signer, SystemProgram, TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";

import { InstructionType, MakeInstructionOutType, TxVersion } from "../base";
import { getATAAddress } from "../base/pda";
import { SYSVAR_RENT_PUBKEY, TOKEN_PROGRAM_ID, validateAndParsePublicKey } from "../common";
import { BigNumberish, parseBigNumberish } from "../entity";
import { u8 } from "../marshmallow";
import { WSOL } from "../token";

import { SPL_ACCOUNT_LAYOUT } from "./layout";

// https://github.com/solana-labs/solana-program-library/tree/master/token/js/client
export class Spl {
  static getAssociatedTokenAccount({ mint, owner }: { mint: PublicKey; owner: PublicKey }) {
    // return getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, mint, owner, true);
    return getATAAddress(owner, mint).publicKey
  }

  static makeCreateAssociatedTokenAccountInstruction({
    mint,
    associatedAccount,
    owner,
    payer,
    instructionsType,
  }: {
    mint: PublicKey;
    associatedAccount: PublicKey;
    owner: PublicKey;
    payer: PublicKey;
    instructionsType: InstructionType[];
  }) {
    instructionsType.push(InstructionType.createATA)
    return createAssociatedTokenAccountInstruction(
      payer,
      associatedAccount,
      owner,
      mint,
    );
  }

  // https://github.com/solana-labs/solana-program-library/blob/master/token/js/client/token.js
  static async makeCreateWrappedNativeAccountInstructions({
    connection,
    owner,
    payer,
    amount,
    // baseRentExemption,
    commitment,
  }: {
    connection: Connection;
    owner: PublicKey;
    payer: PublicKey;
    amount: BigNumberish;
    // baseRentExemption?: number;
    commitment?: Commitment;
  }) {
    const instructions: TransactionInstruction[] = [];
    const instructionTypes: InstructionType[] = []

    // Allocate memory for the account
    // baseRentExemption = getMinimumBalanceForRentExemption size is 0
    // -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0", "id":1, "method":"getMinimumBalanceForRentExemption", "params":[0]}'
    // baseRentExemption = perByteRentExemption * 128
    // balanceNeeded = baseRentExemption / 128 * (dataSize + 128)
    const balanceNeeded = await connection.getMinimumBalanceForRentExemption(SPL_ACCOUNT_LAYOUT.span, commitment);

    // Create a new account
    const lamports = parseBigNumberish(amount).add(new BN(balanceNeeded));
    const newAccount = Keypair.generate();
    instructions.push(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: newAccount.publicKey,
        lamports: lamports.toNumber(),
        space: SPL_ACCOUNT_LAYOUT.span,
        programId: TOKEN_PROGRAM_ID,
      }),
    );
    instructionTypes.push(InstructionType.createAccount)

    // * merge this instruction into SystemProgram.createAccount
    // * will save transaction size ~17(441-424) bytes
    // Send lamports to it (these will be wrapped into native tokens by the token program)
    // instructions.push(
    //   SystemProgram.transfer({
    //     fromPubkey: payer,
    //     toPubkey: newAccount.publicKey,
    //     lamports: parseBigNumberish(amount).toNumber(),
    //   }),
    // );

    // Assign the new account to the native token mint.
    // the account will be initialized with a balance equal to the native token balance.
    // (i.e. amount)
    instructions.push(
      this.makeInitAccountInstruction({
        mint: validateAndParsePublicKey(WSOL.mint),
        tokenAccount: newAccount.publicKey,
        owner,
        instructionTypes,
      }),
    );
    

    return {
      address: { newAccount: newAccount.publicKey },
      innerTransaction: {
        instructions,
        signers: [newAccount],
        lookupTableAddress: [],
        instructionTypes,
        supportedVersion: [TxVersion.LEGACY, TxVersion.V0]
      }
    }
  }

  static async insertCreateWrappedNativeAccount({
    connection,
    owner,
    payer,
    amount,
    instructions,
    instructionsType,
    signers,
    commitment,
  }: {
    connection: Connection;
    owner: PublicKey;
    payer: PublicKey;
    amount: BigNumberish;
    instructions: TransactionInstruction[];
    instructionsType: InstructionType[];
    signers: Signer[];
    commitment?: Commitment;
  }) {
    const ins = await this.makeCreateWrappedNativeAccountInstructions({
      connection,
      owner,
      payer,
      amount,
      commitment,
    });

    instructions.push(...ins.innerTransaction.instructions);
    signers.push(...ins.innerTransaction.signers);
    instructionsType.push(...ins.innerTransaction.instructionTypes)

    return ins.address.newAccount
  }

  static makeInitMintInstruction({
    mint,
    decimals,
    mintAuthority,
    freezeAuthority = null,
    instructionTypes
  }: {
    mint: PublicKey;
    decimals: number;
    mintAuthority: PublicKey;
    freezeAuthority?: PublicKey | null;
    instructionTypes: InstructionType[];
  }) {
    instructionTypes.push(InstructionType.initMint)
    return createInitializeMintInstruction(mint, decimals, mintAuthority, freezeAuthority);
  }

  static makeMintToInstruction({
    mint,
    dest,
    authority,
    amount,
    multiSigners = [],
    instructionTypes,
  }: {
    mint: PublicKey;
    dest: PublicKey;
    authority: PublicKey;
    amount: BigNumberish;
    multiSigners?: Signer[];
    instructionTypes: InstructionType[];
  }) {
    instructionTypes.push(InstructionType.mintTo)
    return createMintToInstruction(mint, dest, authority, BigInt(String(amount)), multiSigners);
  }

  static makeInitAccountInstruction({
    mint,
    tokenAccount,
    owner,
    instructionTypes,
  }: {
    mint: PublicKey;
    tokenAccount: PublicKey;
    owner: PublicKey;
    instructionTypes: InstructionType[];
  }) {
    instructionTypes.push(InstructionType.initAccount)
    return createInitializeAccountInstruction(tokenAccount, mint, owner);
  }

  static makeTransferInstruction({
    source,
    destination,
    owner,
    amount,
    multiSigners = [],
    instructionsType
  }: {
    source: PublicKey;
    destination: PublicKey;
    owner: PublicKey;
    amount: BigNumberish;
    multiSigners?: Signer[];
    instructionsType: InstructionType[];
  }) {
    instructionsType.push(InstructionType.transferAmount)
    return createTransferInstruction(
      source,
      destination,
      owner,
      BigInt(String(amount)),
      multiSigners
    );
  }

  static makeCloseAccountInstruction({
    tokenAccount,
    owner,
    payer,
    multiSigners = [],
    instructionsType
  }: {
    tokenAccount: PublicKey;
    owner: PublicKey;
    payer: PublicKey;
    multiSigners?: Signer[];
    instructionsType: InstructionType[]
  }) {
    instructionsType.push(InstructionType.closeAccount)
    return createCloseAccountInstruction(tokenAccount, payer, owner, multiSigners);
  }

  static createInitAccountInstruction(programId: PublicKey, mint: PublicKey, account: PublicKey, owner: PublicKey) {
    const keys = [{
      pubkey: account,
      isSigner: false,
      isWritable: true
    }, {
      pubkey: mint,
      isSigner: false,
      isWritable: false
    }, {
      pubkey: owner,
      isSigner: false,
      isWritable: false
    }, {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false
    }];
    const dataLayout = u8('instruction');
    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(1, data);
    return new TransactionInstruction({
      keys,
      programId,
      data
    });
  }
}
