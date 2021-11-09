import { SerumVersion } from "./type";

export const SERUM_PROGRAM_ID_V3 = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

// serum program id => serum version
export const SERUM_PROGRAMID_TO_VERSION: {
  [key: string]: SerumVersion;
} = {
  [SERUM_PROGRAM_ID_V3]: 3,
};

// serum version => serum program id
export const SERUM_VERSION_TO_PROGRAMID: { [key in SerumVersion]?: string } & {
  [K: number]: string;
} = {
  3: SERUM_PROGRAM_ID_V3,
};
