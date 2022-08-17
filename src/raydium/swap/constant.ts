import { PublicKey } from "@solana/web3.js";

import {
  ETHMint,
  mSOLMint,
  PAIMint,
  RAYMint,
  stSOLMint,
  USDCMint,
  USDHMint,
  USDTMint,
  WSOLMint,
} from "../../common/pubKey";

export const defaultRoutes = ["amm", "serum", "route"];

export const swapRouteMiddleMints = [
  USDCMint,
  RAYMint,
  WSOLMint,
  mSOLMint,
  PAIMint,
  stSOLMint,
  USDHMint,
  USDTMint,
  ETHMint,
].map((pubKey) => pubKey.toBase58());

export const _ROUTE_PROGRAM_ID_V1 = "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS";
export const ROUTE_PROGRAM_ID_V1 = new PublicKey(_ROUTE_PROGRAM_ID_V1);
