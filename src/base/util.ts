import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";

import { splitTxAndSigners } from "../common";
import { Spl } from "../spl";
import { WSOL } from "../token";

import { TokenAccount } from "./base";

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
    tx: Spl.makeCloseAccountInstruction({ tokenAccount: i.pubkey, owner: ownerInfo.wallet, payer: ownerInfo.payer })
  }))
  const transactions = splitTxAndSigners({ instructions: instructionsInfo.map(i => i.tx), signers: [], payer: ownerInfo.wallet })
  const amount = instructionsInfo.map(i => i.amount).reduce((a, b) => a.add(b), new BN(0))

  return { transactions, amount }
}