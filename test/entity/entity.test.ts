import { Fraction, parseBigNumberish } from "../../src/entity";

describe("Test parseBigNumberish", () => {
  it("should works when parse string", () => {
    const result = parseBigNumberish("100");
    expect(result.toString(10)).toBe("100");
  });

  it("should works when parse number", () => {
    const result = parseBigNumberish(100);
    expect(result.toString(10)).toBe("100");
  });

  it("should revert when parse invalid string", () => {
    expect(() => parseBigNumberish("100a")).toThrow(/invalid BigNumberish string/);
  });

  it("should revert when parse invalid number", () => {
    expect(() => parseBigNumberish(1.1)).toThrow(/underflow/);
    expect(() => parseBigNumberish(9007199254740991)).toThrow(/overflow/);
  });
});

describe("Test Fraction", () => {
  const _33_fraction = new Fraction(100, 3);
  const _100_fraction = new Fraction(100);

  it("should works when get quotient", () => {
    expect(_33_fraction.quotient.toString(10)).toBe("33");
    expect(_100_fraction.quotient.toString(10)).toBe("100");
  });

  it("should works when get invert", () => {
    expect(_33_fraction.invert().quotient.toString(10)).toBe("0");
    expect(_100_fraction.invert().quotient.toString(10)).toBe("0");
  });
});
