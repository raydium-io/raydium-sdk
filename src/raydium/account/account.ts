import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Commitment, PublicKey } from "@solana/web3.js";

import { AddInstructionParam } from "../../common/txTool";
import ModuleBase, { ModuleBaseProps } from "../moduleBase";
import { TOKEN_WSOL } from "../token/constant";

import { closeAccountInstruction, createWrappedNativeAccountInstructions } from "./instruction";
import { HandleTokenAccountParams, TokenAccount, TokenAccountRaw } from "./types";
import { parseTokenAccountResp } from "./util";

export interface TokenAccountDataProp {
  tokenAccounts?: TokenAccount[];
  tokenAccountRowInfos?: TokenAccountRaw[];
}
export default class Account extends ModuleBase {
  private _tokenAccounts: TokenAccount[] = [];
  private _tokenAccountRawInfos: TokenAccountRaw[] = [];
  private _ataCache: Map<string, PublicKey> = new Map();
  private _accountChangeListenerId?: number;
  private _accountListener: (() => void)[] = [];
  private _clientOwnedToken = false;

  constructor(params: TokenAccountDataProp & ModuleBaseProps) {
    super(params);
    const { tokenAccounts, tokenAccountRowInfos } = params;
    this._tokenAccounts = tokenAccounts || [];
    this._tokenAccountRawInfos = tokenAccountRowInfos || [];
    this._clientOwnedToken = !!(tokenAccounts || tokenAccountRowInfos);
  }

  get tokenAccounts(): TokenAccount[] {
    return this._tokenAccounts;
  }
  get tokenAccountRawInfos(): TokenAccountRaw[] {
    return this._tokenAccountRawInfos;
  }

  public updateTokenAccount({ tokenAccounts, tokenAccountRowInfos }: TokenAccountDataProp): Account {
    if (tokenAccounts) this._tokenAccounts = tokenAccounts;
    if (tokenAccountRowInfos) this._tokenAccountRawInfos = tokenAccountRowInfos;
    this._accountChangeListenerId && this.scope.connection.removeAccountChangeListener(this._accountChangeListenerId);
    this._accountChangeListenerId = undefined;
    this._clientOwnedToken = true;
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
    this.scope.checkOwner();
    const userPubStr = this.scope.ownerPubKey.toBase58();
    if (this._ataCache.has(userPubStr)) this._ataCache.get(userPubStr) as PublicKey;
    const ataPubKey = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      this.scope.ownerPubKey,
      true,
    );
    this._ataCache.set(this.scope.owner.toString(), ataPubKey);
    return ataPubKey;
  }

  public async fetchWalletTokenAccounts(config?: { forceUpdate?: boolean; commitment?: Commitment }): Promise<{
    tokenAccounts: TokenAccount[];
    tokenAccountRawInfos: TokenAccountRaw[];
  }> {
    if (this._clientOwnedToken) {
      return {
        tokenAccounts: this._tokenAccounts,
        tokenAccountRawInfos: this._tokenAccountRawInfos,
      };
    }
    if (!config?.forceUpdate && this._tokenAccounts) {
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
      const instruction = await Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mint,
        ataAddress,
        owner,
        owner,
      );
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
    const { side, amount, mint, tokenAccount, payer = this.scope.ownerPubKey, bypassAssociatedCheck } = params;

    const txBuilder = this.createTxBuilder();

    const ata = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      this.scope.ownerPubKey,
      true,
    );

    if (new PublicKey(TOKEN_WSOL.mint).equals(mint)) {
      const txInstruction = await createWrappedNativeAccountInstructions({
        connection: this.scope.connection,
        owner: this.scope.ownerPubKey,
        payer,
        amount,
      });
      txBuilder.addInstruction(txInstruction);
      return { tokenAccount: txInstruction.signers![0].publicKey, ...txInstruction };
    } else if (!tokenAccount || (side === "out" && !ata.equals(tokenAccount) && !bypassAssociatedCheck)) {
      return {
        tokenAccount: ata,
        instructions: [
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            mint,
            ata,
            this.scope.ownerPubKey,
            this.scope.ownerPubKey,
          ),
        ],
      };
    }

    return { tokenAccount };
  }
}
