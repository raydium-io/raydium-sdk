import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Commitment, PublicKey } from "@solana/web3.js";

import Module, { ModuleProps } from "../module";

import { TokenAccount, TokenAccountRaw } from "./types";
import { parseTokenAccountResp } from "./util";

export interface TokenAccountDataProp {
  tokenAccounts?: TokenAccount[];
  tokenAccountRowInfos?: TokenAccountRaw[];
}
export default class Account extends Module {
  private _tokenAccounts: TokenAccount[] = [];
  private _tokenAccountRawInfos: TokenAccountRaw[] = [];
  private _ataCache: Map<string, PublicKey> = new Map();
  private _accountChangeLisenerId?: number;
  private _accountListener: (() => void)[] = [];

  constructor(params: TokenAccountDataProp & ModuleProps) {
    super(params);
    this._tokenAccounts = params.tokenAccounts || [];
    this._tokenAccountRawInfos = params.tokenAccountRowInfos || [];
  }

  get tokenAccouns(): TokenAccount[] {
    return this._tokenAccounts;
  }
  get tokenAccounRawInfos(): TokenAccountRaw[] {
    return this._tokenAccountRawInfos;
  }

  get userKeys(): { owner: PublicKey | undefined; tokenAccounts: TokenAccount[] } {
    return {
      owner: this.scope.owner.publicKey,
      tokenAccounts: this._tokenAccounts,
    };
  }

  public updateTokenAccount({ tokenAccounts, tokenAccountRowInfos }: TokenAccountDataProp): Account {
    if (tokenAccounts) this._tokenAccounts = tokenAccounts;
    if (tokenAccountRowInfos) this._tokenAccountRawInfos = tokenAccountRowInfos;
    this._accountChangeLisenerId && this.scope.connection.removeAccountChangeListener(this._accountChangeLisenerId);
    this._accountChangeLisenerId = undefined;
    return this;
  }

  public addAccountChangeListener(cbk: () => void): Account {
    this._accountListener.push(cbk);
    return this;
  }

  public removeAccountChangeListener(cbk: () => void): Account {
    this._accountListener = this._accountListener.filter((listener) => listener !== cbk);
    return this;
  }

  public async getAssociatedTokenAccount(mint: PublicKey): Promise<PublicKey> {
    this.scope.checkowner();
    const userPubStr = this.scope.owner.toString();
    if (this._ataCache.has(userPubStr)) this._ataCache.get(userPubStr) as PublicKey;
    const ataPubKey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      this.scope.owner.publicKey,
      true,
    );
    this._ataCache.set(this.scope.owner.toString(), ataPubKey);
    return ataPubKey;
  }

  public async getWalletTokenAccounts(config?: { commitment: Commitment }): Promise<{
    tokenAccounts: TokenAccount[];
    tokenAccountRawInfos: TokenAccountRaw[];
  }> {
    this.scope.checkowner();
    if (this._tokenAccounts.length) {
      return {
        tokenAccounts: this._tokenAccounts,
        tokenAccountRawInfos: this._tokenAccountRawInfos,
      };
    }

    const defaultConfig = {};
    const customConfig = { ...defaultConfig, ...config };

    const solAccountResp = await this.scope.connection.getAccountInfo(
      this.scope.owner.publicKey,
      customConfig.commitment,
    );
    const ownerTokenAccountResp = await this.scope.connection.getTokenAccountsByOwner(
      this.scope.owner.publicKey,
      { programId: TOKEN_PROGRAM_ID },
      customConfig.commitment,
    );

    const { tokenAccounts, tokenAccountRawInfos } = parseTokenAccountResp({
      solAccountResp,
      tokenAccountResp: ownerTokenAccountResp,
    });

    this._tokenAccounts = tokenAccounts;
    this._tokenAccountRawInfos = tokenAccountRawInfos;

    this._accountChangeLisenerId && this.scope.connection.removeAccountChangeListener(this._accountChangeLisenerId);
    this._accountChangeLisenerId = this.scope.connection.onAccountChange(
      this.scope.owner.publicKey,
      () => this.getWalletTokenAccounts(),
      "confirmed",
    );

    return { tokenAccounts, tokenAccountRawInfos };
  }

  // user token account needed
  public async selectTokenAccount({
    mint,
    associatedOnly = false,
  }: {
    mint: PublicKey;
    associatedOnly?: boolean;
  }): Promise<PublicKey | undefined> {
    await this.getWalletTokenAccounts();
    const tokenAccounts = this._tokenAccounts
      .filter(({ mint: accountMint }) => accountMint?.equals(mint))
      // sort by balance
      .sort((a, b) => (a.amount.lt(b.amount) ? 1 : -1));

    const ata = await this.getAssociatedTokenAccount(mint);
    for (const tokenAccount of tokenAccounts) {
      const { publicKey } = tokenAccount;
      if (publicKey) {
        if (associatedOnly && ata.equals(publicKey)) return publicKey;
        return publicKey;
      }
    }
  }
}
