/* eslint-disable @typescript-eslint/ban-ts-comment */

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export function inspectPublicKey() {
  if (typeof Symbol !== "undefined" && typeof Symbol.for === "function") {
    try {
      PublicKey.prototype[Symbol.for("nodejs.util.inspect.custom")] = function () {
        return `<PublicKey: ${this.toString()}>`;
      };
    } catch (e) {
      // @ts-ignore
      PublicKey.prototype.inspect = function () {
        return `<PublicKey: ${this.toString()}>`;
      };
    }
  } else {
    // @ts-ignore
    PublicKey.prototype.inspect = function () {
      return `<PublicKey: ${this.toString()}>`;
    };
  }
}

export function inspectBN() {
  if (typeof Symbol !== "undefined" && typeof Symbol.for === "function") {
    try {
      BN.prototype[Symbol.for("nodejs.util.inspect.custom")] = function () {
        // @ts-ignore
        return `<${this.red ? "BN-R" : "BN"}: ${this.toString()}>`;
      };
    } catch (e) {
      // @ts-ignore
      BN.prototype.inspect = function () {
        // @ts-ignore
        return `<${this.red ? "BN-R" : "BN"}: ${this.toString()}>`;
      };
    }
  } else {
    // @ts-ignore
    BN.prototype.inspect = function () {
      // @ts-ignore
      return `<${this.red ? "BN-R" : "BN"}: ${this.toString()}>`;
    };
  }
}
