// import { PublicKey } from "@solana/web3.js";

// import { LiquidityVersion } from "../liquidity";

// import { RouteVersion } from "./type";

// /* ================= program public keys ================= */
// export const _ROUTE_PROGRAM_ID_V1 = "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS";
// export const ROUTE_PROGRAM_ID_V1 = new PublicKey(_ROUTE_PROGRAM_ID_V1);

// // route program id string => route version
// export const ROUTE_PROGRAMID_TO_VERSION: {
//   [key: string]: RouteVersion;
// } = {
//   [_ROUTE_PROGRAM_ID_V1]: 1,
// };

// // route version => route program id
// export const ROUTE_VERSION_TO_PROGRAMID: { [key in RouteVersion]?: PublicKey } & {
//   [K: number]: PublicKey;
// } = {
//   1: ROUTE_PROGRAM_ID_V1,
// };

// // route version => serum version
// export const ROUTE_VERSION_TO_LIQUIDITY_VERSION: {
//   [key in RouteVersion]?: LiquidityVersion;
// } & {
//   [K: number]: LiquidityVersion;
// } = {
//   1: 4,
// };
