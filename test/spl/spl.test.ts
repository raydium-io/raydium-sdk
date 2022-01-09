import { PublicKey } from "@solana/web3.js";

import { Spl } from "../../src/spl";

const ACCOUNT = new PublicKey("1".repeat(32));

describe("Test parseBigNumberIsh", () => {
  it("should works when pass number", () => {
    Spl.makeTransferInstruction({
      source: ACCOUNT,
      destination: ACCOUNT,
      owner: ACCOUNT,
      amount: 1,
    });
  });
});
