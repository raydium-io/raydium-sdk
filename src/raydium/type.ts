import { Connection, PublicKey, SendOptions, Signer, Transaction } from "@solana/web3.js";

import { ApiTokenCategory, ApiTokenInfo } from "../api";

export interface RaydiumTokenInfo extends ApiTokenInfo {
  category: ApiTokenCategory;
}

export type SendTransaction = (
  transaction: Transaction,
  connection: Connection,
  options?: SendOptions & { signers: Signer[] },
) => Promise<string>;

export interface MakeTransaction {
  signers: Signer[];
  transaction: Transaction;
  execute: () => Promise<string>;
  extInfo: Record<string, any>;
}

export interface LoadParams {
  forceUpdate?: boolean;
}

type Primitive = boolean | number | string | null | undefined | PublicKey;

/**
 *
 * @example
 * ```typescript
 * interface A {
 *   keyA: string;
 *   keyB: string;
 *   map: {
 *     hello: string;
 *     i: number;
 *   };
 *   list: (string | number)[];
 *   keyC: number;
 * }
 *
 * type WrappedA = ReplaceType<A, string, boolean> // {
 *   keyA: boolean;
 *   keyB: boolean;
 *   map: {
 *     hello: boolean;
 *     i: number;
 *   };
 *   list: (number | boolean)[];
 *   keyC: number;
 * }
 * ```
 */
export type ReplaceType<Old, From, To> = {
  [T in keyof Old]: Old[T] extends From // to avoid case: Old[T] is an Object,
    ? Exclude<Old[T], From> | To // when match,  directly replace
    : Old[T] extends Primitive // judge whether need recursively replace
    ? From extends Old[T] // it's an Object
      ? Exclude<Old[T], From> | To // directly replace
      : Old[T] // stay same
    : ReplaceType<Old[T], From, To>; // recursively replace
};

export type MayArray<T> = T | Array<T>;

export type MayDeepArray<T> = T | Array<MayDeepArray<T>>;

export type MayFunction<T, PS extends any[] = []> = T | ((...Params: PS) => T);

export type ArrayItem<T extends ReadonlyArray<any>> = T extends Array<infer P> ? P : never;

export type ExactPartial<T, U> = {
  [P in Extract<keyof T, U>]?: T[P];
} & {
  [P in Exclude<keyof T, U>]: T[P];
};

export type ExactRequired<T, U> = {
  [P in Extract<keyof T, U>]-?: T[P];
} & {
  [P in Exclude<keyof T, U>]: T[P];
};

/**
 * extract only string and number
 */
export type SKeyof<O> = Extract<keyof O, string>;

export type GetValue<T, K> = K extends keyof T ? T[K] : undefined;
/**
 * @example
 * type A = { a: number; b: string; c?: string }
 * type B = { a: string; c: string; d?: boolean }
 *
 * type D = SOR<A, B> // { a: number | string; b: string | undefined; c: string | undefined; d: boolean | undefined } // ! if use SOR, you lost union type guard feature, try NOT to use this trick
 */
export type SOR<T, U> = { [K in keyof T | keyof U]: GetValue<T, K> | GetValue<U, K> };

export type Fallback<T, FallbackT> = T extends undefined ? FallbackT : T;

/**
 * @example
 * type A = { a: number; b: string; c?: string }
 * type B = { a: string; c: string; d?: boolean }
 *
 * type D = Cover<A, B> // { a: string; b: string; c: string; d?: boolean}
 */
export type Cover<O, T> = { [K in SKeyof<O> | SKeyof<T>]: Fallback<GetValue<T, K>, GetValue<O, K>> };

export type UnionCover<O, T> = T extends T ? Cover<O, T> : never;

type MergeArr<Arr> = (Arr extends (infer T)[] ? T : never)[];

/**
 * typescript type helper function
 * @example
 * type A = { hello: string; version: 3 }[]
 * type B = { hello: string; version: 5 }[]
 * type OK = MergeArr<A | B> // ({ hello: string; version: 3 } | { hello: string; version: 5 })[]
 * type Wrong = A | B // { hello: string; version: 3 }[] | { hello: string; version: 5 }[] // <= this type can't have auto type intelligense of array.map
 */
export const unionArr = <T>(arr: T): MergeArr<T> => arr as unknown as MergeArr<T>;
