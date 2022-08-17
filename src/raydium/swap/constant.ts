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
