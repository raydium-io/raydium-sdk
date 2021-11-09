import { FarmVersion } from "./type";

export const FARM_PROGRAM_ID_V3 = "EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q";
export const FARM_PROGRAM_ID_V5 = "9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4z";

// farm program id => farm version
export const FARM_PROGRAMID_TO_VERSION: {
  [key: string]: FarmVersion;
} = {
  [FARM_PROGRAM_ID_V3]: 3,
  [FARM_PROGRAM_ID_V5]: 5,
};

// farm version => farm program id
export const FARM_VERSION_TO_PROGRAMID: { [key in FarmVersion]?: string } & {
  [K: number]: string;
} = {
  3: FARM_PROGRAM_ID_V3,
  5: FARM_PROGRAM_ID_V5,
};
