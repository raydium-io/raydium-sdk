import { PublicKey } from "@solana/web3.js";

import { Logger } from "../common";

import { ROUTE_PROGRAMID_TO_VERSION, ROUTE_VERSION_TO_LIQUIDITY_VERSION, ROUTE_VERSION_TO_PROGRAMID } from "./id";

const logger = Logger.from("Route");

export class Route {
  /* ================= get version and program id ================= */
  static getProgramId(version: number) {
    const programId = ROUTE_VERSION_TO_PROGRAMID[version];
    logger.assertArgument(!!programId, "invalid version", "version", version);

    return programId;
  }

  static getVersion(programId: PublicKey) {
    const programIdString = programId.toBase58();

    const version = ROUTE_PROGRAMID_TO_VERSION[programIdString];
    logger.assertArgument(!!version, "invalid program id", "programId", programIdString);

    return version;
  }

  static getLiquidityVersion(version: number) {
    const liquidityVersion = ROUTE_VERSION_TO_LIQUIDITY_VERSION[version];
    logger.assertArgument(!!liquidityVersion, "invalid version", "version", version);

    return liquidityVersion;
  }

  /* ================= make instruction and transaction ================= */
  // static makeSwapInInstruction() {}

  // static makeSwapOutInstruction() {}

  /* ================= compute data ================= */
  // static computeCurrencyAmountOut() {}

  // static computeCurrencyAmountIn() {}
}
