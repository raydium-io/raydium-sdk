import {
  getTransferFeeConfig, Mint, TransferFee, TransferFeeConfig, unpackMint,
} from '@solana/spl-token';
import {
  Connection, EpochInfo, PublicKey, Transaction, TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import BN from 'bn.js';

import {
  getMultipleAccountsInfoWithCustomFlags, getMultipleLookupTableInfo,
  splitTxAndSigners, TOKEN_PROGRAM_ID,
} from '../common';
import { CurrencyAmount, ONE, TokenAmount, ZERO } from '../entity';
import { Spl } from '../spl';
import { WSOL } from '../token';

import { TokenAccount } from './base';
import { InnerTransaction, TxVersion } from './type';

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
    tx: Spl.makeCloseAccountInstruction({ programId: TOKEN_PROGRAM_ID, tokenAccount: i.pubkey, owner: ownerInfo.wallet, payer: ownerInfo.payer, instructionsType: [] })
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

export interface TransferAmountFee {amount: TokenAmount | CurrencyAmount, fee: TokenAmount | CurrencyAmount | undefined, expirationTime: number | undefined}
export interface GetTransferAmountFee {amount: BN, fee: BN | undefined, expirationTime: number | undefined}
const POINT = 10_000
export function getTransferAmountFee(amount: BN, feeConfig: TransferFeeConfig | undefined, epochInfo: EpochInfo, addFee: boolean): GetTransferAmountFee {
  if (feeConfig === undefined) {
    return {
      amount,
      fee: undefined,
      expirationTime: undefined
    }
  }

  const nowFeeConfig: TransferFee = epochInfo.epoch < feeConfig.newerTransferFee.epoch ? feeConfig.olderTransferFee : feeConfig.newerTransferFee
  const maxFee = new BN(nowFeeConfig.maximumFee.toString())
  const expirationTime: number | undefined = epochInfo.epoch < feeConfig.newerTransferFee.epoch ? (Number(feeConfig.newerTransferFee.epoch) * epochInfo.slotsInEpoch - epochInfo.absoluteSlot) * 400 / 1000 : undefined

  if (addFee) {
    if (nowFeeConfig.transferFeeBasisPoints === POINT) {
      const nowMaxFee = new BN(nowFeeConfig.maximumFee.toString())
      return {
        amount: amount.add(nowMaxFee),
        fee: nowMaxFee,
        expirationTime,
      }
    } else {
      const _TAmount = BNDivCeil(amount.mul(new BN(POINT)), new BN(POINT - nowFeeConfig.transferFeeBasisPoints))

      const nowMaxFee = new BN(nowFeeConfig.maximumFee.toString())
      const TAmount = _TAmount.sub(amount).gt(nowMaxFee) ? amount.add(nowMaxFee) : _TAmount
  
      const _fee = BNDivCeil(TAmount.mul(new BN(nowFeeConfig.transferFeeBasisPoints)), new BN(POINT))
      const fee = _fee.gt(maxFee) ? maxFee : _fee
      return {
        amount: TAmount,
        fee,
        expirationTime,
      }
    }
  } else {
    const _fee = BNDivCeil(amount.mul(new BN(nowFeeConfig.transferFeeBasisPoints)), new BN(POINT))
    const fee = _fee.gt(maxFee) ? maxFee : _fee

    return {
      amount,
      fee,
      expirationTime,
    }
  }
}

export function minExpirationTime(expirationTime1: number | undefined, expirationTime2: number | undefined): number | undefined {
  if (expirationTime1 === undefined) return expirationTime2
  if (expirationTime2 === undefined) return expirationTime1

  return Math.min(expirationTime1, expirationTime2)
}

export type ReturnTypeFetchMultipleMintInfo = Mint & { feeConfig: TransferFeeConfig | undefined; }
export interface ReturnTypeFetchMultipleMintInfos { [mint: string]: ReturnTypeFetchMultipleMintInfo; }

export async function fetchMultipleMintInfos({ connection, mints, }: { connection: Connection, mints: PublicKey[]}) {
  if (mints.length === 0) return {}
  const mintInfos = await getMultipleAccountsInfoWithCustomFlags(connection, mints.map(i => ({ pubkey: i})))

  const mintK: ReturnTypeFetchMultipleMintInfos = {}
  for (const i of mintInfos) {
    const t = unpackMint(i.pubkey, i.accountInfo, i.accountInfo?.owner)
    mintK[i.pubkey.toString()] = {
      ...t,
      feeConfig: getTransferFeeConfig(t) ?? undefined
    }
  }

  return mintK
}


export function BNDivCeil(bn1: BN, bn2: BN) {
  const {div, mod} = bn1.divmod(bn2)

  if (mod.gt(ZERO)) {
    return div.add(ONE)
  } else {
    return div
  }
}
