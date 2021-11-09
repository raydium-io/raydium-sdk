import dotenv from "dotenv";

import { Connection, PublicKey } from "@solana/web3.js";
import {
  getMultipleAccountsInfo, TOKEN_PROGRAM_ID, validateAndParsePublicKey
} from "../src/solana";
import { MAINNET_SPL_TOKENS, WSOL } from "../src/token";

dotenv.config();

describe("Test validateAndParsePublicKey", () => {
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

describe("Test getMultipleAccountsInfo", () => {
  const endpoint = process.env.RPC_ENDPOINT;
  const connection = new Connection(String(endpoint));
  const pubkeys = [
    new PublicKey(WSOL.mint),
    new PublicKey(MAINNET_SPL_TOKENS.RAY.mint),
    // null data
    new PublicKey("RaypHMpEFpcf32NH8H9FW3RC4GLRDFcHd99GcyS51SG"),
  ];

  it("should works when use valid pubkeys with batch request", async () => {
    const result = await getMultipleAccountsInfo(connection, pubkeys, { batchRequest: true });

    expect(result.length).toEqual(pubkeys.length);
    expect(result[0]).not.toBeNaN();
    expect(result[0]?.owner.equals(TOKEN_PROGRAM_ID)).toBeTruthy();

    expect(result[1]).not.toBeNaN();
  });

  it("should works when use valid pubkeys without batch request", async () => {
    const result = await getMultipleAccountsInfo(connection, pubkeys, { batchRequest: false });

    expect(result.length).toEqual(pubkeys.length);
    expect(result[0]).not.toBeNaN();
    expect(result[0]?.owner.equals(TOKEN_PROGRAM_ID)).toBeTruthy();

    expect(result[1]).not.toBeNaN();
  });
});
