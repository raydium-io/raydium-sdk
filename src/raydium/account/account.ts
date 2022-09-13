import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Commitment, PublicKey } from "@solana/web3.js";

import { AddInstructionParam } from "../../common/txTool";
import ModuleBase, { ModuleBaseProps } from "../moduleBase";
import { TOKEN_WSOL } from "../token/constant";

import { closeAccountInstruction, createWSolAccountInstructions } from "./instruction";
import { HandleTokenAccountParams, TokenAccount, TokenAccountRaw } from "./types";
import { parseTokenAccountResp } from "./util";

export interface TokenAccountDataProp {
  tokenAccounts?: TokenAccount[];
  tokenAccountRawInfos?: TokenAccountRaw[];
}
export default class Account extends ModuleBase {
  private _tokenAccounts: TokenAccount[] = [];
  private _tokenAccountRawInfos: TokenAccountRaw[] = [];
  private _ataCache: Map<string, PublicKey> = new Map();
  private _accountChangeListenerId?: number;
  private _accountListener: ((data: TokenAccountDataProp) => void)[] = [];
  private _clientOwnedToken = false;

  constructor(params: TokenAccountDataProp & ModuleBaseProps) {
    super(params);
    const { tokenAccounts, tokenAccountRawInfos } = params;
    this._tokenAccounts = tokenAccounts || [];
    this._tokenAccountRawInfos = tokenAccountRawInfos || [];
    this._clientOwnedToken = !!(tokenAccounts || tokenAccountRawInfos);
  }

  get tokenAccounts(): TokenAccount[] {
    return this._tokenAccounts;
  }
  get tokenAccountRawInfos(): TokenAccountRaw[] {
    return this._tokenAccountRawInfos;
  }

  public updateTokenAccount({ tokenAccounts, tokenAccountRawInfos }: TokenAccountDataProp): Account {
    if (tokenAccounts) this._tokenAccounts = tokenAccounts;
    if (tokenAccountRawInfos) this._tokenAccountRawInfos = tokenAccountRawInfos;
    this._accountChangeListenerId && this.scope.connection.removeAccountChangeListener(this._accountChangeListenerId);
    this._accountChangeListenerId = undefined;
    this._clientOwnedToken = true;
    return this;
  }

  public addAccountChangeListener(cbk: (data: TokenAccountDataProp) => void): Account {
    this._accountListener.push(cbk);
    return this;
  }

  public removeAccountChangeListener(cbk: (data: TokenAccountDataProp) => void): Account {
    this._accountListener = this._accountListener.filter((listener) => listener !== cbk);
    return this;
  }

  public async getAssociatedTokenAccount(mint: PublicKey): Promise<PublicKey> {
    this.scope.checkOwner();
    const cacheKey = `${this.scope.ownerPubKey.toBase58()}_${mint.toBase58()}`;
    if (this._ataCache.has(cacheKey)) return this._ataCache.get(cacheKey) as PublicKey;
    const ataPubKey = await getAssociatedTokenAddress(mint, this.scope.ownerPubKey, true);
    this._ataCache.set(cacheKey, ataPubKey);
    return ataPubKey;
  }

  public async fetchWalletTokenAccounts(config?: { forceUpdate?: boolean; commitment?: Commitment }): Promise<{
    tokenAccounts: TokenAccount[];
    tokenAccountRawInfos: TokenAccountRaw[];
  }> {
    if (this._clientOwnedToken || (!config?.forceUpdate && this._tokenAccounts.length)) {
      return {
        tokenAccounts: this._tokenAccounts,
        tokenAccountRawInfos: this._tokenAccountRawInfos,
      };
    }
    this.scope.checkOwner();

    const defaultConfig = {};
    const customConfig = { ...defaultConfig, ...config };

    const solAccountResp = await this.scope.connection.getAccountInfo(this.scope.ownerPubKey, customConfig.commitment);
    const ownerTokenAccountResp = await this.scope.connection.getTokenAccountsByOwner(
      this.scope.ownerPubKey,
      { programId: TOKEN_PROGRAM_ID },
      customConfig.commitment,
    );

    const { tokenAccounts, tokenAccountRawInfos } = parseTokenAccountResp({
      solAccountResp,
      tokenAccountResp: ownerTokenAccountResp,
    });

    this._tokenAccounts = tokenAccounts;
    this._tokenAccountRawInfos = tokenAccountRawInfos;

    this._accountChangeListenerId && this.scope.connection.removeAccountChangeListener(this._accountChangeListenerId);
    this._accountChangeListenerId = this.scope.connection.onAccountChange(
      this.scope.ownerPubKey,
      () => this.fetchWalletTokenAccounts({ forceUpdate: true }),
      "confirmed",
    );

    return { tokenAccounts, tokenAccountRawInfos };
  }

  // user token account needed
  public async getCreatedTokenAccount({
    mint,
    associatedOnly = true,
  }: {
    mint: PublicKey;
    associatedOnly?: boolean;
  }): Promise<PublicKey | undefined> {
    await this.fetchWalletTokenAccounts();
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

  public async checkOrCreateAta({
    mint,
    autoUnwrapWSOLToSOL,
  }: {
    mint: PublicKey;
    autoUnwrapWSOLToSOL?: boolean;
  }): Promise<{ pubKey: PublicKey; newInstructions: AddInstructionParam }> {
    await this.fetchWalletTokenAccounts();
    let tokenAccountAddress = this.scope.account.tokenAccounts.find(
      ({ mint: accountTokenMint }) => accountTokenMint?.toBase58() === mint.toBase58(),
    )?.publicKey;

    const owner = this.scope.ownerPubKey;
    const newTxInstructions: AddInstructionParam = {};

    if (!tokenAccountAddress) {
      const ataAddress = await this.getAssociatedTokenAccount(mint);
      const instruction = await createAssociatedTokenAccountInstruction(owner, ataAddress, owner, mint);
      newTxInstructions.instructions = [instruction];
      tokenAccountAddress = ataAddress;
    }
    if (autoUnwrapWSOLToSOL && TOKEN_WSOL.mint === mint.toBase58()) {
      newTxInstructions.endInstructions = [
        closeAccountInstruction({ owner, payer: owner, tokenAccount: tokenAccountAddress }),
      ];
    }

    return {
      pubKey: tokenAccountAddress,
      newInstructions: newTxInstructions,
    };
  }

  public async handleTokenAccount(
    params: HandleTokenAccountParams,
  ): Promise<AddInstructionParam & { tokenAccount: PublicKey }> {
    const {
      side,
      amount,
      mint,
      tokenAccount,
      payer = this.scope.ownerPubKey,
      bypassAssociatedCheck,
      skipCloseAccount,
    } = params;

    const txBuilder = this.createTxBuilder();

    const ata = await getAssociatedTokenAddress(mint, this.scope.ownerPubKey, true);

    if (new PublicKey(TOKEN_WSOL.mint).equals(mint)) {
      const txInstruction = await createWSolAccountInstructions({
        connection: this.scope.connection,
        owner: this.scope.ownerPubKey,
        payer,
        amount,
        skipCloseAccount,
      });
      txBuilder.addInstruction(txInstruction);
      return { tokenAccount: txInstruction.signers![0].publicKey, ...txInstruction };
    } else if (!tokenAccount || (side === "out" && !ata.equals(tokenAccount) && !bypassAssociatedCheck)) {
      return {
        tokenAccount: ata,
        instructions: [
          createAssociatedTokenAccountInstruction(this.scope.ownerPubKey, ata, this.scope.ownerPubKey, mint),
        ],
      };
    }

    return { tokenAccount };
  }
}
