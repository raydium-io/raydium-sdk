import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Commitment, Keypair, PublicKey, Signer, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { BigNumberish, parseBigNumberish, validateAndParsePublicKey } from "../../common";
import { TOKEN_SOL, TOKEN_WSOL } from "../../token";
import Module, { ModuleProps } from "../module";

import { splAccountLayout } from "./layout";
import { TokenAccount, TokenAccountRaw } from "./types";

export interface DefaultAccountProp {
  defaultTokenAccounts?: TokenAccount[];
  defaultTokenAccountRowInfos?: TokenAccountRaw[];
}
export default class Account extends Module {
  private _tokenAccounts: TokenAccount[] = [];
  private _tokenAccountRawInfos: TokenAccountRaw[] = [];
  private _ataCache: Map<string, PublicKey> = new Map();

  constructor(params: DefaultAccountProp & ModuleProps) {
    super(params);
    this._tokenAccounts = params.defaultTokenAccounts || [];
    this._tokenAccountRawInfos = params.defaultTokenAccountRowInfos || [];
  }

  get tokenAccouns(): TokenAccount[] {
    return this._tokenAccounts;
  }
  get tokenAccounRawInfos(): TokenAccountRaw[] {
    return this._tokenAccountRawInfos;
  }

  get userKeys(): { owner: PublicKey | undefined; tokenAccounts: TokenAccountRaw[] } {
    return {
      owner: this.scope.owner.publicKey,
      tokenAccounts: this._tokenAccountRawInfos,
    };
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

  public async getWalletTokenAccounts({ config }: { config?: { commitment: Commitment } }): Promise<{
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

    const tokenAccounts: TokenAccount[] = [];
    const tokenAccountRawInfos: TokenAccountRaw[] = [];

    for (const { pubkey, account } of ownerTokenAccountResp.value) {
      if (account.data.length !== splAccountLayout.span) {
        throw this.logAndCreateError("invalid token account layout length", "publicKey", pubkey.toBase58());
      }

      const accountInfo = splAccountLayout.decode(account.data);
      const { mint, amount } = accountInfo;

      const ata = await this.getAssociatedTokenAccount(mint);
      tokenAccounts.push({
        publicKey: pubkey,
        mint,
        amount,
        isAssociated: ata.equals(pubkey),
        isNative: false,
      });
      tokenAccountRawInfos.push({ pubkey, accountInfo });
    }

    if (solAccountResp) {
      tokenAccounts.push({
        amount: new BN(solAccountResp.lamports),
        isNative: true,
      });
    }

    this._tokenAccounts = tokenAccounts;
    this._tokenAccountRawInfos = tokenAccountRawInfos;

    return { tokenAccounts, tokenAccountRawInfos };
  }

  public async selectTokenAccount({
    mint,
    associatedOnly = false,
  }: {
    mint: PublicKey;
    associatedOnly?: boolean;
  }): Promise<PublicKey | undefined> {
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

  public makeInitAccountInstruction({
    mint,
    tokenAccount,
    owner,
  }: {
    mint: PublicKey;
    tokenAccount: PublicKey;
    owner?: PublicKey;
  }): TransactionInstruction {
    if (!owner) this.checkDisabled();
    return Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID,
      mint,
      tokenAccount,
      owner || this.scope.owner.publicKey,
    );
  }

  public async makeCreateWrappedNativeAccountInstructions({
    payer,
    amount,
    commitment,
  }: {
    payer: PublicKey;
    amount: BigNumberish;
    commitment?: Commitment;
  }): Promise<{
    signer: Keypair;
    instructions: TransactionInstruction[];
  }> {
    const instructions: TransactionInstruction[] = [];

    const balanceNeeded = await this.scope.connection.getMinimumBalanceForRentExemption(
      splAccountLayout.span,
      commitment,
    );

    const lamports = parseBigNumberish(amount).add(new BN(balanceNeeded));
    const newAccount = Keypair.generate();
    instructions.push(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: newAccount.publicKey,
        lamports: lamports.toNumber(),
        space: splAccountLayout.span,
        programId: TOKEN_PROGRAM_ID,
      }),
    );

    instructions.push(
      this.makeInitAccountInstruction({
        mint: validateAndParsePublicKey(TOKEN_WSOL.mint),
        tokenAccount: newAccount.publicKey,
      }),
    );

    return { signer: newAccount, instructions };
  }

  public makeCloseAccountInstruction({
    tokenAccount,
    payer,
    multiSigners = [],
  }: {
    tokenAccount: PublicKey;
    payer: PublicKey;
    multiSigners?: Signer[];
  }): TransactionInstruction {
    return Token.createCloseAccountInstruction(
      TOKEN_PROGRAM_ID,
      tokenAccount,
      payer,
      this.scope.owner.publicKey,
      multiSigners,
    );
  }
}
