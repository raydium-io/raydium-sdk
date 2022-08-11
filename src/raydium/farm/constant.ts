import { PublicKey } from "@solana/web3.js";

import {
  FarmLedgerLayout,
  farmLedgerLayoutV3_2,
  farmLedgerLayoutV5_2,
  farmLedgerLayoutV6_1,
  FarmStateLayout,
  farmStateV6Layout,
} from "./layout";

/* ================= program public keys ================= */
export const FARM_PROGRAM_ID_V3 = "EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q";
export const FARM_PROGRAM_ID_V3_PUBKEY = new PublicKey(FARM_PROGRAM_ID_V3);
export const FARM_PROGRAM_ID_V5 = "9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4z";
export const FARM_PROGRAM_ID_V5_PUBKEY = new PublicKey(FARM_PROGRAM_ID_V5);
export const FARM_PROGRAM_ID_V6 = "FarmqiPv5eAj3j1GMdMCMUGXqPUvmquZtMy86QH6rzhG";
export const FARM_PROGRAM_ID_V6_PUBKEY = new PublicKey(FARM_PROGRAM_ID_V6);

export type FarmVersion = 3 | 4 | 5 | 6;

// farm program id string => farm version
export const FARM_PROGRAMID_TO_VERSION: {
  [key: string]: FarmVersion;
} = {
  [FARM_PROGRAM_ID_V3]: 3,
  [FARM_PROGRAM_ID_V5]: 5,
  [FARM_PROGRAM_ID_V6]: 6,
};

// farm version => farm program id
export const FARM_VERSION_TO_PROGRAMID: { [key in FarmVersion]?: PublicKey } & {
  [K: number]: PublicKey;
} = {
  3: FARM_PROGRAM_ID_V3_PUBKEY,
  5: FARM_PROGRAM_ID_V5_PUBKEY,
  6: FARM_PROGRAM_ID_V6_PUBKEY,
};

export const FARM_LOCK_MINT = new PublicKey("4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R");
export const FARM_LOCK_VAULT = new PublicKey("FrspKwj8i3pNmKwXreTveC4fu7KL5ZbGeXdZBe2XViu1");

/* ================= index ================= */
// version => farm state layout
export const FARM_VERSION_TO_STATE_LAYOUT: {
  [version in FarmVersion]?: FarmStateLayout;
} = {
  6: farmStateV6Layout,
};

// version => farm ledger layout
export const FARM_VERSION_TO_LEDGER_LAYOUT: {
  [version in FarmVersion]?: FarmLedgerLayout;
} = {
  3: farmLedgerLayoutV3_2,
  5: farmLedgerLayoutV5_2,
  6: farmLedgerLayoutV6_1,
};
