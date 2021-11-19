import { blob, struct, u32, u64, u8, union } from "../../src/marshmallow";

describe("Test marshmallow", () => {
  describe("Encode", () => {
    it("should works when encode union", () => {
      const LAYOUT = union(u8("instruction"));
      LAYOUT.addVariant(3, struct([u64("maxBaseAmount"), u64("maxQuoteAmount"), u64("fixedFrom")]), "addLiquidity");
      LAYOUT.addVariant(4, struct([u64("maxLpAmount")]), "removeLiquidity"); // FIXME: miss 4

      const encoded = LAYOUT.encodeInstruction({ removeLiquidity: { maxLpAmount: 1 } });
      expect(encoded.toString("hex")).toEqual("040100000000000000");
    });

    it("should works when use encodeInstruction", () => {
      const LAYOUT = union(u8("instruction"));
      LAYOUT.addVariant(3, struct([u8("maxBaseAmount"), u8("maxQuoteAmount"), u8("fixedFrom")]), "addLiquidity");
      LAYOUT.addVariant(4, struct([u8("maxLpAmount")]), "removeLiquidity");

      const encoded = LAYOUT.encodeInstruction({ removeLiquidity: { maxLpAmount: 1 } });
      expect(encoded.toString("hex")).toEqual("0401");
    });
  });

  describe("Decode", () => {
    it("should works when decode u8", () => {
      const LAYOUT = u8("status");
      const decoded = LAYOUT.decode(Buffer.from([1]));
      expect(decoded).toEqual(1);
    });

    it("should works when decode u64", () => {
      const LAYOUT = u64("status");
      const decoded = LAYOUT.decode(Buffer.from([1]));
      expect(decoded.toString(10)).toEqual("1");
    });

    it("should works when decode struct", () => {
      const LAYOUT = struct([u8("status"), u64("nonce"), u32(), blob(8)]);
      const { status, nonce } = LAYOUT.decode(Buffer.from([1, 2]));
      expect(status).toEqual(1);
      expect(nonce.toString(10)).toEqual("2");
    });
  });
});
