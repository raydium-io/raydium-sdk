import { PublicKey } from "@solana/web3.js";

import { validateAndParsePublicKey } from "../../src/common";
import { WSOL } from "../../src/token";

describe("validateAndParsePublicKey", () => {
  it("should works when use valid pubkey string", () => {
    const pubkey = validateAndParsePublicKey(WSOL.mint);
    expect(pubkey.toBase58()).toEqual(WSOL.mint);
  });

  it("should works when use valid pubkey", () => {
    const wsol = new PublicKey(WSOL.mint);
    const pubkey = validateAndParsePublicKey(wsol);
    expect(pubkey.equals(wsol)).toBeTruthy();
  });

  it("should revert when use invalid pubkey string", () => {
    expect(() => validateAndParsePublicKey("1")).toThrow(/invalid public key/);
  });
});
