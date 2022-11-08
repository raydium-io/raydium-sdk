import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { BigNumberish, parseNumberInfo, toBN, toTokenPrice } from "../../common/bignumber";
import { PublicKeyish, SOLMint, validateAndParsePublicKey } from "../../common/pubKey";
import { Token, TokenAmount, Fraction, Price } from "../../module";
import ModuleBase, { ModuleBaseProps } from "../moduleBase";
import { LoadParams } from "../type";

import { quantumSOLHydratedTokenJsonInfo, TOKEN_WSOL } from "./constant";
import { SplToken, TokenJson } from "./type";
import { sortTokens } from "./util";

export interface MintToTokenAmount {
  mint: PublicKeyish;
  amount: BigNumberish;
  decimalDone?: boolean;
}

export default class TokenModule extends ModuleBase {
  private _tokens: TokenJson[] = [];
  private _tokenMap: Map<string, SplToken> = new Map();
  private _tokenPrice: Map<string, Price> = new Map();
  private _mintList: { official: string[]; unOfficial: string[]; unNamed: string[] };

  constructor(params: ModuleBaseProps) {
    super(params);
    this._mintList = { official: [], unOfficial: [], unNamed: [] };
  }

  public async load(params?: LoadParams): Promise<void> {
    this.checkDisabled();
    await this.scope.fetchTokens(params?.forceUpdate);
    // unofficial: solana token list
    // official: raydium token list
    this._mintList = { official: [], unOfficial: [], unNamed: [] };
    this._tokens = [];
    this._tokenMap = new Map();
    const { data } = this.scope.apiData.tokens || {
      data: { official: [], unOfficial: [], unNamed: [], blacklist: [] },
    };

    const blacklistSet = new Set(data.blacklist);
    [data.official, data.unOfficial, data.unNamed].forEach((tokenGroup, idx) => {
      tokenGroup.forEach((token) => {
        const category = ["official", "unOfficial", "unNamed"][idx];
        if (!blacklistSet.has(token.mint) && token.mint !== SOLMint.toBase58()) {
          this._tokens.push({
            ...token,
            symbol: token.symbol || "",
            name: token.name || "",
          });
          this._mintList[category].push(token.mint);
        }
      });
    });
    this._mintList["official"].push(quantumSOLHydratedTokenJsonInfo.mint.toBase58());
    this._tokens = sortTokens(this._tokens, this._mintList);
    this._tokens.push({
      ...quantumSOLHydratedTokenJsonInfo,
      mint: SOLMint.toBase58(),
    });
    this._tokens.forEach((token) => {
      this._tokenMap.set(token.mint, {
        ...token,
        id: token.mint,
      });
    });
    this._tokenMap.set(TOKEN_WSOL.mint, { ...TOKEN_WSOL, icon: quantumSOLHydratedTokenJsonInfo.icon, id: "wsol" });
    this._tokenMap.set(SOLMint.toBase58(), { ...quantumSOLHydratedTokenJsonInfo, mint: SOLMint.toBase58() });
  }

  get allTokens(): TokenJson[] {
    return this._tokens;
  }
  get allTokenMap(): Map<string, SplToken> {
    return this._tokenMap;
  }
  get tokenMints(): { official: string[]; unOfficial: string[] } {
    return this._mintList;
  }
  get tokenPrices(): Map<string, Price> {
    return this._tokenPrice;
  }

  public async fetchTokenPrices(preloadRaydiumPrice?: Record<string, number>): Promise<Map<string, Price>> {
    const coingeckoTokens = this.allTokens.filter(
      (token) => !!token.extensions?.coingeckoId && token.mint !== PublicKey.default.toBase58(),
    );
    const coingeckoIds = coingeckoTokens.map((token) => token.extensions.coingeckoId!);
    const coingeckoPriceRes = await this.scope.api.getCoingeckoPrice(coingeckoIds);

    const coingeckoPrices: { [key: string]: Price } = coingeckoTokens.reduce(
      (acc, token) =>
        coingeckoPriceRes[token.extensions.coingeckoId!]?.usd
          ? {
              ...acc,
              [token.mint]: toTokenPrice({
                token: this._tokenMap.get(token.mint)!,
                numberPrice: coingeckoPriceRes[token.extensions.coingeckoId!].usd!,
                decimalDone: true,
              }),
            }
          : acc,
      {},
    );

    const raydiumPriceRes = preloadRaydiumPrice || (await this.scope.api.getRaydiumTokenPrice());
    const raydiumPrices: { [key: string]: Price } = Object.keys(raydiumPriceRes).reduce(
      (acc, key) =>
        this._tokenMap.get(key)
          ? {
              ...acc,
              [key]: toTokenPrice({
                token: this._tokenMap.get(key)!,
                numberPrice: raydiumPriceRes[key],
                decimalDone: true,
              }),
            }
          : acc,
      {},
    );
    this._tokenPrice = new Map([...Object.entries(coingeckoPrices), ...Object.entries(raydiumPrices)]);
    return this._tokenPrice;
  }

  public mintToToken(mint: PublicKeyish): Token {
    const _mint = validateAndParsePublicKey({ publicKey: mint, transformSol: true });
    const tokenInfo = this.allTokenMap.get(_mint.toBase58());
    if (!tokenInfo) this.logAndCreateError("token not found, mint:", _mint.toBase58());
    const { decimals, name, symbol } = tokenInfo!;
    return new Token({ mint, decimals, name, symbol });
  }

  public mintToTokenAmount({ mint, amount, decimalDone }: MintToTokenAmount): TokenAmount {
    const token = this.mintToToken(mint);

    if (decimalDone) {
      const numberDetails = parseNumberInfo(amount);
      const amountBigNumber = toBN(
        new Fraction(numberDetails.numerator, numberDetails.denominator).mul(new BN(10).pow(new BN(token.decimals))),
      );
      return new TokenAmount(token, amountBigNumber);
    }
    return new TokenAmount(token, this.decimalAmount({ mint, amount, decimalDone }));
  }

  public decimalAmount({ mint, amount }: MintToTokenAmount): BN {
    const numberDetails = parseNumberInfo(amount);
    const token = this.mintToToken(mint);
    return toBN(new Fraction(numberDetails.numerator, numberDetails.denominator).mul(new BN(10 ** token.decimals)));
  }

  public uiAmount({ mint, amount }: MintToTokenAmount): string {
    const numberDetails = parseNumberInfo(amount);
    const token = this.mintToToken(mint);
    if (!token) return "";
    return new Fraction(numberDetails.numerator, numberDetails.denominator)
      .div(new BN(10 ** token.decimals))
      .toSignificant(token.decimals);
  }
}
