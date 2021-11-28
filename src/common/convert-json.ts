import { PublicKey } from "@solana/web3.js";
import { Logger } from "./logger";
import { validateAndParsePublicKey } from "./pubkey";

const logger = new Logger("Common.CovertJson");

type Primitive = boolean | number | string | null | undefined;

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
  [T in keyof Old]: Old[T] extends Primitive
    ? From extends Old[T]
      ? Exclude<Old[T], From> | To
      : Old[T]
    : ReplaceType<Old[T], From, To>;
};

export function jsonInfo2PoolKeys<T>(jsonInfo: T): ReplaceType<T, string, PublicKey> {
  // @ts-expect-error no need type for inner code
  return Object.entries(jsonInfo).reduce((result, [key, value]) => {
    const valueType = typeof value;

    switch (valueType) {
      case "string":
        result[key] = validateAndParsePublicKey(value);
        break;
      case "object":
        result[key] = value.map((k) => validateAndParsePublicKey(k));
        break;
      case "number":
        result[key] = value;
        break;
      default:
        return logger.throwArgumentError("invalid value", key, value);
    }

    return result;
  }, {});
}
