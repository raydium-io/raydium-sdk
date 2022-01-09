import { PublicKey } from "@solana/web3.js";

import { Logger } from "./logger";
import { validateAndParsePublicKey } from "./pubkey";

const logger = new Logger("Common.CovertJson");

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

export function jsonInfo2PoolKeys<T>(jsonInfo: T): ReplaceType<T, string, PublicKey> {
  // @ts-expect-error no need type for inner code
  return Object.entries(jsonInfo).reduce((result, [key, value]) => {
    if (typeof value === "string") {
      result[key] = validateAndParsePublicKey(value);
    } else if (value instanceof Array) {
      result[key] = value.map((k) => validateAndParsePublicKey(k));
    } else if (typeof value === "number") {
      result[key] = value;
    } else {
      return logger.throwArgumentError("invalid value", key, value);
    }

    return result;
  }, {});
}

export function poolKeys2JsonInfo<T>(jsonInfo: T): ReplaceType<T, PublicKey, string> {
  // @ts-expect-error no need type for inner code
  return Object.entries(jsonInfo).reduce((result, [key, value]) => {
    if (value instanceof PublicKey) {
      result[key] = value.toBase58();
    } else if (value instanceof Array) {
      result[key] = value.map((k) => k.toBase58());
    } else if (typeof value === "number") {
      result[key] = value;
    } else {
      return logger.throwArgumentError("invalid value", key, value);
    }

    return result;
  }, {});
}
