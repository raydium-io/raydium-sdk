import { publicKey, struct, u32, u64, u8 } from "../../marshmallow";

export const SPL_MINT_LAYOUT = struct([
  u32("mintAuthorityOption"),
  publicKey("mintAuthority"),
  u64("supply"),
  u8("decimals"),
  u8("isInitialized"),
  u32("freezeAuthorityOption"),
  publicKey("freezeAuthority"),
]);

export type SplMintLayout = typeof SPL_MINT_LAYOUT;
