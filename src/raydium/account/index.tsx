import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Commitment } from "@solana/web3.js";

import { Raydium } from "../raydium";

export default class Account {
  public scope: Raydium | undefined = undefined;

  constructor(scope: Raydium) {
    this.scope = scope;
  }

  public async getWalletTokenAccounts({ config }: { config?: { commitment: Commitment } }): Promise<any> {
    if (!this.scope || !this.scope.user) return undefined;
    const defaultConfig = {};
    const customConfig = { ...defaultConfig, ...config };

    const solReq = this.scope.connection.getAccountInfo(this.scope.user, customConfig.commitment);
    const tokenReq = this.scope.connection.getTokenAccountsByOwner(
      this.scope.user,
      { programId: TOKEN_PROGRAM_ID },
      customConfig.commitment,
    );

    const [solResp, tokenResp] = await Promise.all([solReq, tokenReq]);

    const accounts: any[] = [];
    const rawInfos: any[] = [];

    return { accounts, rawInfos };
  }
}
