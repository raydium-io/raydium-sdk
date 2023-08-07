import {
  getTransferFeeConfig, Mint, TransferFee, TransferFeeConfig, unpackMint,
} from '@solana/spl-token';
import {
  Connection, EpochInfo, Message, MessageV0, PublicKey, TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import BN from 'bn.js';

import {
  CacheLTA, getMultipleAccountsInfoWithCustomFlags, getMultipleLookupTableInfo,
  splitTxAndSigners, TOKEN_PROGRAM_ID,
} from '../common';
import { CurrencyAmount, ONE, TokenAmount, ZERO } from '../entity';
import { Spl } from '../spl';
import { WSOL } from '../token';

import { TokenAccount } from './base';
import { LOOKUP_TABLE_CACHE } from './lookupTableCache';
import {
  InnerSimpleTransaction, InnerSimpleV0Transaction, InnerTransaction,
  InstructionType, TxVersion,
} from './type';

export function getWSOLAmount({tokenAccounts}: {tokenAccounts: TokenAccount[]}) {
  const WSOL_MINT = new PublicKey(WSOL.mint)
  const amounts = tokenAccounts.filter(i => i.accountInfo.mint.equals(WSOL_MINT)).map(i => i.accountInfo.amount)
  const amount = amounts.reduce((a, b) => a.add(b), new BN(0))
  return amount
}

export async function unwarpSol({ ownerInfo, tokenAccounts, makeTxVersion, connection }: {
  connection: Connection,
  ownerInfo: {
    wallet: PublicKey,
    payer: PublicKey
  },
  tokenAccounts: TokenAccount[],
  makeTxVersion: TxVersion, 
}) {
  const WSOL_MINT = new PublicKey(WSOL.mint)
  const instructionsInfo = tokenAccounts.filter(i => i.accountInfo.mint.equals(WSOL_MINT)).map(i => ({
    amount: i.accountInfo.amount,
    tx: Spl.makeCloseAccountInstruction({ programId: TOKEN_PROGRAM_ID, tokenAccount: i.pubkey, owner: ownerInfo.wallet, payer: ownerInfo.payer, instructionsType: [] })
  }))

  return {
    address: {},
    innerTransactions: await splitTxAndSigners({ connection, makeTxVersion, payer: ownerInfo.payer, innerTransaction: instructionsInfo.map(i => ({
      instructionTypes: [InstructionType.closeAccount],
      instructions: [i.tx],
      signers: []
    }))})
  }
}

export async function buildSimpleTransaction({connection, makeTxVersion, payer, innerTransactions, recentBlockhash}: {
  makeTxVersion: TxVersion, 
  payer: PublicKey,
  connection: Connection,
  innerTransactions: InnerSimpleTransaction[], 
  recentBlockhash?: string | undefined,
}): Promise<VersionedTransaction[]> {
  if (makeTxVersion !== TxVersion.V0 && makeTxVersion !== TxVersion.LEGACY) throw Error(' make tx version args error')

  const _recentBlockhash = recentBlockhash ?? (await connection.getLatestBlockhash()).blockhash;

  const txList: VersionedTransaction[] = []
  for (const itemIx of innerTransactions) {
    const transactionMessage = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: _recentBlockhash,
      instructions: itemIx.instructions,
    })

    const itemMessage: Message | MessageV0 = makeTxVersion === TxVersion.LEGACY ? transactionMessage.compileToLegacyMessage() : transactionMessage.compileToV0Message(Object.values({...LOOKUP_TABLE_CACHE, ...((itemIx as InnerSimpleV0Transaction).lookupTableAddress ?? {})}))
    const itemVersionedTransaction = new VersionedTransaction(itemMessage)
    itemVersionedTransaction.sign(itemIx.signers)

    txList.push(itemVersionedTransaction)
  }
  return txList
}

export async function buildTransaction({connection, makeTxVersion, payer, innerTransactions, recentBlockhash, lookupTableCache}: {
  makeTxVersion: TxVersion, 
  payer: PublicKey,
  connection: Connection,
  innerTransactions: InnerTransaction[], 
  recentBlockhash?: string | undefined,
  lookupTableCache?: CacheLTA,
}): Promise<VersionedTransaction[]> {
  if (makeTxVersion !== TxVersion.V0 && makeTxVersion !== TxVersion.LEGACY) throw Error(' make tx version args error')

  const _recentBlockhash = recentBlockhash ?? (await connection.getLatestBlockhash()).blockhash;
  const _lookupTableCache = lookupTableCache ?? {}

  const lta = [...new Set<string>(['2immgwYNHBbyVQKVGCEkgWpi53bLwWNRMB5G2nbgYV17', ...innerTransactions.map(i => i.lookupTableAddress ?? []).flat().map(i => i.toString())])]
  const needCacheLTA = []
  for (const item of lta) {
    if (_lookupTableCache[item] === undefined) {
      needCacheLTA.push(new PublicKey(item))
    }
  }
  const lookupTableAccountsCache = needCacheLTA.length > 0 ? await getMultipleLookupTableInfo({connection, address: needCacheLTA}) : {}
  for (const [key, value] of Object.entries(lookupTableAccountsCache)) {
    _lookupTableCache[key] = value
  }

  const txList: VersionedTransaction[] = []
  for (const itemIx of innerTransactions) {
    const transactionMessage = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: _recentBlockhash,
      instructions: itemIx.instructions,
    })

    if (makeTxVersion === TxVersion.LEGACY) {
      const itemV = new VersionedTransaction(transactionMessage.compileToLegacyMessage())
      itemV.sign(itemIx.signers)
      txList.push(itemV)
    } else if (makeTxVersion === TxVersion.V0) {
      const _itemLTA: CacheLTA = {}
      for (const item of itemIx.lookupTableAddress?? []) {
        _itemLTA[item.toString()] = _lookupTableCache[item.toString()]
      }
      const itemV = new VersionedTransaction(transactionMessage.compileToV0Message(Object.values(_itemLTA)))
      itemV.sign(itemIx.signers)
       txList.push(itemV)
    } else {
      throw Error(' make tx version check error ')
    }
  }
  return txList
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
