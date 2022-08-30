import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { Fraction, Percent, Price, Token, TokenAmount } from "../module";
import { ReplaceType } from "../raydium/type";

import { tryParsePublicKey } from "./pubKey";

export async function sleep(ms: number): Promise<void> {
  new Promise((resolve) => setTimeout(resolve, ms));
}

export function getTimestamp(): number {
  return new Date().getTime();
}

const baseInnerObjects = [Token, TokenAmount, PublicKey, Fraction, BN, Price, Percent];

function notInnerObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !baseInnerObjects.some((o) => typeof o === "object" && v instanceof o);
}

export function jsonInfo2PoolKeys<T>(jsonInfo: T): ReplaceType<T, string, PublicKey> {
  // @ts-expect-error no need type for inner code
  return typeof jsonInfo === "string"
    ? tryParsePublicKey(jsonInfo)
    : Array.isArray(jsonInfo)
    ? jsonInfo.map((k) => jsonInfo2PoolKeys(k))
    : notInnerObject(jsonInfo)
    ? Object.fromEntries(Object.entries(jsonInfo).map(([k, v]) => [k, jsonInfo2PoolKeys(v)]))
    : jsonInfo;
}
