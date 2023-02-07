import { Connection, PublicKey, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { BN } from "bn.js";

import { getMultipleLookupTableInfo, splitTxAndSigners } from "../common";
import { Spl } from "../spl";
import { WSOL } from "../token";

import { TokenAccount } from "./base";
import { InnerTransaction, MakeInstructionSimpleOutType, TxVersion } from "./type";

export function getWSOLAmount({tokenAccounts}: {tokenAccounts: TokenAccount[]}) {
  const WSOL_MINT = new PublicKey(WSOL.mint)
  const amounts = tokenAccounts.filter(i => i.accountInfo.mint.equals(WSOL_MINT)).map(i => i.accountInfo.amount)
  const amount = amounts.reduce((a, b) => a.add(b), new BN(0))
  return amount
}

export function unwarpSol({ ownerInfo, tokenAccounts }: {
  ownerInfo: {
    wallet: PublicKey,
    payer: PublicKey
  },
  tokenAccounts: TokenAccount[],
}) {
  const WSOL_MINT = new PublicKey(WSOL.mint)
  const instructionsInfo = tokenAccounts.filter(i => i.accountInfo.mint.equals(WSOL_MINT)).map(i => ({
    amount: i.accountInfo.amount,
    tx: Spl.makeCloseAccountInstruction({ tokenAccount: i.pubkey, owner: ownerInfo.wallet, payer: ownerInfo.payer, instructionsType: [] })
  }))
  const transactions = splitTxAndSigners({ instructions: instructionsInfo.map(i => i.tx), signers: [], payer: ownerInfo.wallet })

  return {
    address: {},
    innerTransactions: transactions.map(i => ({
      instructions: i.instruction,
      signers: i.signer,
      lookupTableAddress: [],
      instructionTypes: new Array(i.instruction.length).fill('closeAccount'),
      supportedVersion: [TxVersion.LEGACY, TxVersion.V0]
    }))
  }
}

export async function buildTransaction({connection, txType, payer, innerTransactions, recentBlockhash}: {
  txType: TxVersion.V0, 
  payer: PublicKey,
  connection: Connection,
  innerTransactions: InnerTransaction[], 
  recentBlockhash?: string | undefined
}): Promise<VersionedTransaction[]> 
export async function buildTransaction({connection, txType, payer, innerTransactions, recentBlockhash}: {
  txType: TxVersion.LEGACY, 
  payer: PublicKey,
  connection: Connection,
  innerTransactions: InnerTransaction[], 
  recentBlockhash?: string | undefined
}): Promise<Transaction[]> 
export async function buildTransaction({connection, txType, payer, innerTransactions, recentBlockhash}: {
  txType: TxVersion, 
  payer: PublicKey,
  connection: Connection,
  innerTransactions: InnerTransaction[], 
  recentBlockhash?: string | undefined
}): Promise<VersionedTransaction[] | Transaction[]>
export async function buildTransaction({connection, txType, payer, innerTransactions, recentBlockhash}: {
  txType: TxVersion, 
  payer: PublicKey,
  connection: Connection,
  innerTransactions: InnerTransaction[], 
  recentBlockhash?: string | undefined
}): Promise<VersionedTransaction[] | Transaction[]> {
  const _recentBlockhash = recentBlockhash ?? await (await connection.getLatestBlockhash()).blockhash;

  if (txType === TxVersion.V0) {
    const lookupTableAddress = innerTransactions.map(i => i.lookupTableAddress ?? []).flat()
    const lookupTableAccounts = lookupTableAddress.length > 0 ? await getMultipleLookupTableInfo({connection, address: lookupTableAddress}) : []

    const versionedTransaction: VersionedTransaction[] = []
    for (const itemInss of innerTransactions) {
      if (itemInss.supportedVersion.find(i => i === TxVersion.V0) === undefined) throw Error('has error type transaction')
      
      const messageV0 = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: _recentBlockhash,
        instructions: itemInss.instructions,
      }).compileToV0Message(lookupTableAccounts);
      const t = new VersionedTransaction(messageV0);
      t.sign(itemInss.signers)
      versionedTransaction.push(t)
    }
    return versionedTransaction
  } else {
    return innerTransactions.map(itemInss => {
      if (itemInss.supportedVersion.find(i => i === TxVersion.LEGACY) === undefined) throw Error('has error type transaction')
      const t = new Transaction().add(...itemInss.instructions)
      t.recentBlockhash = _recentBlockhash
      t.feePayer = payer
      if (itemInss.signers.length > 0) t.sign(...itemInss.signers)
      return t
    })
  }
}
