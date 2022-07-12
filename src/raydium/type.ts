import { ApiTokenCategory, ApiTokenInfo } from "../api";

export interface RaydiumTokenInfo extends ApiTokenInfo {
  category: ApiTokenCategory;
}
