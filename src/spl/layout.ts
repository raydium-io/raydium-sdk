import { publicKey, struct, u32, u64, u8 } from "../marshmallow";
import { GetStructureSchema } from "../types/buffer-layout";

export const SPL_MINT_LAYOUT = struct([
  u32("mintAuthorityOption"),
  publicKey("mintAuthority"),
  u64("supply"),
  u8("decimals"),
  u8("isInitialized"),
  u32("freezeAuthorityOption"),
  publicKey("freezeAuthority"),
]);

export type SplMintLayout = GetStructureSchema<typeof SPL_MINT_LAYOUT>;

export const SPL_ACCOUNT_LAYOUT = struct([
  publicKey("mint"),
  publicKey("owner"),
  u64("amount"),
  u32("delegateOption"),
  publicKey("delegate"),
  u8("state"),
  u32("isNativeOption"),
  u64("isNative"),
  u64("delegatedAmount"),
  u32("closeAuthorityOption"),
  publicKey("closeAuthority"),
]);

export type SplAccountLayout = GetStructureSchema<typeof SPL_ACCOUNT_LAYOUT>;
