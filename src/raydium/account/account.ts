import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  AccountLayout,
} from "@solana/spl-token";
import { Commitment, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { BigNumberish, WSOLMint } from "../../common";

import { AddInstructionParam } from "../../common/txTool";
import ModuleBase, { ModuleBaseProps } from "../moduleBase";

import {
  closeAccountInstruction,
  createWSolAccountInstructions,
  makeTransferInstruction,
  initTokenAccountInstruction,
} from "./instruction";
import { HandleTokenAccountParams, TokenAccount, TokenAccountRaw, GetOrCreateTokenAccountParams } from "./types";
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

    const [solAccountResp, ownerTokenAccountResp] = await Promise.all([
      this.scope.connection.getAccountInfo(this.scope.ownerPubKey, customConfig.commitment),
      this.scope.connection.getTokenAccountsByOwner(
        this.scope.ownerPubKey,
        { programId: TOKEN_PROGRAM_ID },
        customConfig.commitment,
      ),
    ]);

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

  // user token account needed, old _selectTokenAccount
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

  // old _selectOrCreateTokenAccount
  public async getOrCreateTokenAccount(params: GetOrCreateTokenAccountParams): Promise<{
    account?: PublicKey;
    instructionParams?: AddInstructionParam;
  }> {
    await this.fetchWalletTokenAccounts();
    const { mint, createInfo, associatedOnly, owner, notUseTokenAccount = false, skipCloseAccount = false } = params;
    const ata = await getAssociatedTokenAddress(mint, this.scope.ownerPubKey!, true);
    const accounts = (notUseTokenAccount ? [] : this.tokenAccountRawInfos)
      .filter((i) => i.accountInfo.mint.equals(mint) && (!associatedOnly || i.pubkey.equals(ata)))
      .sort((a, b) => (a.accountInfo.amount.lt(b.accountInfo.amount) ? 1 : -1));
    // find token or don't need create
    if (createInfo === undefined || accounts.length > 0) {
      return accounts.length > 0 ? { account: accounts[0].pubkey } : {};
    }

    const newTxInstructions: AddInstructionParam = {
      instructions: [],
      endInstructions: [],
      signers: [],
    };

    if (associatedOnly) {
      newTxInstructions.instructions!.push(createAssociatedTokenAccountInstruction(owner, ata, owner, mint));

      if (mint.equals(WSOLMint)) {
        const txInstruction = await createWSolAccountInstructions({
          connection: this.scope.connection,
          owner: this.scope.ownerPubKey,
          payer: createInfo.payer || this.scope.ownerPubKey,
          amount: createInfo.amount || 0,
          skipCloseAccount,
        });
        newTxInstructions.instructions!.push(...(txInstruction.instructions || []));
        newTxInstructions.endInstructions!.push(...(txInstruction.endInstructions || []));
        newTxInstructions.signers!.push(...(txInstruction.signers || []));

        if (createInfo.amount) {
          newTxInstructions.instructions!.push(
            makeTransferInstruction({
              source: txInstruction.signers![0].publicKey,
              destination: ata,
              owner: this.scope.ownerPubKey,
              amount: createInfo.amount,
            }),
          );
        }
      }

      if (!skipCloseAccount) {
        newTxInstructions.endInstructions!.push(
          closeAccountInstruction({ owner, payer: createInfo.payer || owner, tokenAccount: ata }),
        );
      }

      return { account: ata, instructionParams: newTxInstructions };
    } else {
      if (mint.equals(WSOLMint)) {
        const txInstruction = await createWSolAccountInstructions({
          connection: this.scope.connection,
          owner: this.scope.ownerPubKey,
          payer: createInfo.payer || this.scope.ownerPubKey,
          amount: createInfo.amount || 0,
          skipCloseAccount,
        });
        newTxInstructions.instructions!.push(...(txInstruction.instructions || []));
        newTxInstructions.endInstructions!.push(...(txInstruction.endInstructions || []));
        newTxInstructions.signers!.push(...(txInstruction.signers || []));

        return { account: txInstruction.signers![0].publicKey, instructionParams: newTxInstructions };
      } else {
        const newTokenAccount = Keypair.generate();
        const balanceNeeded = await this.scope.connection.getMinimumBalanceForRentExemption(AccountLayout.span);

        const createAccountIns = SystemProgram.createAccount({
          fromPubkey: owner,
          newAccountPubkey: newTokenAccount.publicKey,
          lamports: balanceNeeded,
          space: AccountLayout.span,
          programId: TOKEN_PROGRAM_ID,
        });

        newTxInstructions.instructions!.push(
          createAccountIns,
          initTokenAccountInstruction({
            mint,
            tokenAccount: newTokenAccount.publicKey,
            owner: this.scope.ownerPubKey,
          }),
        );
        newTxInstructions.signers!.push(newTokenAccount);
        if (!skipCloseAccount) {
          newTxInstructions.endInstructions!.push(
            closeAccountInstruction({
              owner,
              payer: createInfo.payer || owner,
              tokenAccount: newTokenAccount.publicKey,
            }),
          );
        }
        return { account: newTokenAccount.publicKey, instructionParams: newTxInstructions };
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
    if (autoUnwrapWSOLToSOL && WSOLMint.toBase58() === mint.toBase58()) {
      newTxInstructions.endInstructions = [
        closeAccountInstruction({ owner, payer: owner, tokenAccount: tokenAccountAddress }),
      ];
    }

    return {
      pubKey: tokenAccountAddress,
      newInstructions: newTxInstructions,
    };
  }

  // old _handleTokenAccount
  public async handleTokenAccount(
    params: HandleTokenAccountParams,
  ): Promise<AddInstructionParam & { tokenAccount?: PublicKey }> {
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

    if (new PublicKey(WSOLMint).equals(mint)) {
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

  public async processTokenAccount(props: {
    mint: PublicKey;
    amount?: BigNumberish;
    useSOLBalance?: boolean;
    handleTokenAccount?: boolean;
  }): Promise<Promise<AddInstructionParam & { tokenAccount?: PublicKey }>> {
    const { mint, amount, useSOLBalance, handleTokenAccount } = props;
    let tokenAccount: PublicKey | undefined;
    const txBuilder = this.createTxBuilder();

    if (mint.equals(new PublicKey(WSOLMint)) && useSOLBalance) {
      // mintA
      const { tokenAccount: _tokenAccount, ...instructions } = await this.handleTokenAccount({
        side: "in",
        amount: amount || 0,
        mint,
        bypassAssociatedCheck: true,
      });
      tokenAccount = _tokenAccount;
      txBuilder.addInstruction(instructions);
    } else {
      tokenAccount = await this.getCreatedTokenAccount({
        mint,
        associatedOnly: false,
      });
      if (!tokenAccount && handleTokenAccount) {
        const { tokenAccount: _tokenAccount, ...instructions } = await this.scope.account.handleTokenAccount({
          side: "in",
          amount: 0,
          mint,
          bypassAssociatedCheck: true,
        });
        tokenAccount = _tokenAccount;
        txBuilder.addInstruction(instructions);
      }
    }

    return { tokenAccount, ...txBuilder.AllTxData };
  }
}
