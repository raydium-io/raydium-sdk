import { PublicKey } from "@solana/web3.js";

import { PublicKeyish, SOLMint, validateAndParsePublicKey } from "../../common/pubKey";
import { Token } from "../../module/token";
import ModuleBase, { ModuleBaseProps } from "../moduleBase";

import { quantumSOLHydratedTokenJsonInfo } from "./constant";
import { SplToken, TokenJson } from "./type";
import { sortTokens } from "./util";

export default class TokenModule extends ModuleBase {
  private _tokens: TokenJson[] = [];
  private _tokenMap: Map<string, SplToken> = new Map();
  private _mintList: { official: string[]; unOfficial: string[] } = { official: [], unOfficial: [] };

  constructor(params: ModuleBaseProps) {
    super(params);
  }

  public async load(): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchTokens();
    // unofficial: solana token list
    // official: raydium token list
    this._mintList = { official: [], unOfficial: [] };
    this._tokens = [];
    this._tokenMap = new Map();
    const { data } = this.scope.apiData.tokens || { data: { official: [], unOfficial: [], blacklist: [] } };
    const blacklistSet = new Set(data.blacklist);
    [(data.official, data.unOfficial)].forEach((tokenGroup, idx) => {
      tokenGroup.forEach((token) => {
        const category = idx === 0 ? "official" : "unOfficial";
        if (!blacklistSet.has(token.mint) && token.mint !== SOLMint.toBase58()) {
          this._tokens.push(token);
          this._mintList[category].push(token.mint);
        }
      });
    });
    this._tokens = sortTokens(this._tokens, this._mintList);
    this._tokens.forEach((token) => {
      this._tokenMap.set(token.mint, {
        ...token,
        icon: "",
        extensions: {},
        id: token.mint,
      });
    });
    this._tokenMap.set(quantumSOLHydratedTokenJsonInfo.mint.toBase58(), quantumSOLHydratedTokenJsonInfo);
  }

  get allTokens(): TokenJson[] {
    return this._tokens;
  }
  get allTokenMap(): Map<string, SplToken> {
    return this._tokenMap;
  }

  public mintToToken(mint: PublicKeyish): Token {
    const _mint = validateAndParsePublicKey(mint);
    const tokenInfo = this.allTokenMap.get(_mint.toBase58());
    if (!tokenInfo) this.logAndCreateError("token not found, mint:", _mint.toBase58());
    const { decimals, name, symbol } = tokenInfo!;
    return new Token({ mint, decimals, name, symbol });
  }
}
