import { PublicKey } from "@solana/web3.js";

import { FarmVersion } from "./type";

/* ================= program public keys ================= */
export const _FARM_PROGRAM_ID_V3 = "EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q";
export const FARM_PROGRAM_ID_V3 = new PublicKey(_FARM_PROGRAM_ID_V3);
export const _FARM_PROGRAM_ID_V5 = "9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4z";
export const FARM_PROGRAM_ID_V5 = new PublicKey(_FARM_PROGRAM_ID_V5);

// farm program id string => farm version
export const FARM_PROGRAMID_TO_VERSION: {
  [key: string]: FarmVersion;
} = {
  [_FARM_PROGRAM_ID_V3]: 3,
  [_FARM_PROGRAM_ID_V5]: 5,
};

// farm version => farm program id
export const FARM_VERSION_TO_PROGRAMID: { [key in FarmVersion]?: PublicKey } & {
  [K: number]: PublicKey;
} = {
  3: FARM_PROGRAM_ID_V3,
  5: FARM_PROGRAM_ID_V5,
};
