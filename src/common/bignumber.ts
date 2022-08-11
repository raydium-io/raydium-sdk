import BN from "bn.js";

export const TEN = new BN(10);
export type BigNumberish = BN | string | number | bigint;

const MAX_SAFE = 0x1fffffffffffff;

export function parseBigNumberish(value: BigNumberish): BN {
  // BN
  if (value instanceof BN) {
    return value;
  }

  // string
  if (typeof value === "string") {
    if (value.match(/^-?[0-9]+$/)) {
      return new BN(value);
    }

    throw new Error("invalid BigNumberish string");
    // return logger.error("invalid BigNumberish string", "value", value);
  }

  // number
  if (typeof value === "number") {
    if (value % 1) {
      throw new Error("BigNumberish number underflow");
      // return logger.throwArgumentError("BigNumberish number underflow", "value", value);
    }

    if (value >= MAX_SAFE || value <= -MAX_SAFE) {
      throw new Error("BigNumberish number overflow");
      // return logger.throwArgumentError("BigNumberish number overflow", "value", value);
    }

    return new BN(String(value));
  }

  // bigint
  if (typeof value === "bigint") {
    return new BN(value.toString());
  }
  throw new Error("invalid BigNumberish value");
  // return logger.throwArgumentError("invalid BigNumberish value", "value", value);
}

export function tenExponentiate(shift: BigNumberish): BN {
  return TEN.pow(parseBigNumberish(shift));
}

// round up
export function divCeil(a: BN, b: BN): BN {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const dm = a.divmod(b);

  // Fast case - exact division
  if (dm.mod.isZero()) return dm.div;

  // Round up
  return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
}
