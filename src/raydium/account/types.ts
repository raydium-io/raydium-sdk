import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { GetStructureSchema } from "../../marshmallow";

import { splAccountLayout } from "./layout";

export type SplAccountLayout = typeof splAccountLayout;
export type SplAccount = GetStructureSchema<SplAccountLayout>;
export interface TokenAccountRaw {
  pubkey: PublicKey;
  accountInfo: SplAccount;
}

export interface TokenAccount {
  publicKey?: PublicKey;
  mint?: PublicKey;
  isAssociated?: boolean;
  amount: BN;
  isNative: boolean;
}

export interface getCreatedTokenAccountParams {
  mint: PublicKey;
  config?: { associatedOnly?: boolean };
}
