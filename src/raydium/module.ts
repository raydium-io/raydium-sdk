import { PublicKey } from "@solana/web3.js";
import { Logger } from "pino";

import { createLogger } from "../common/logger";
import { TxBuilder } from "../common/txTool";
import { Raydium } from "../raydium";

export interface ModuleProps {
  scope: Raydium;
  moduleName: string;
}
export default class Module {
  public scope: Raydium;
  private disabled = false;
  private logger: Logger;

  constructor({ scope, moduleName }: ModuleProps) {
    this.scope = scope;
    this.logger = createLogger(moduleName);
  }

  protected createTxBuilder(feePayer?: PublicKey): TxBuilder {
    this.scope.checkOwner();
    return new TxBuilder({
      connection: this.scope.connection,
      feePayer: feePayer || this.scope.owner.publicKey,
      owner: this.scope.owner,
      signAllTransactions: this.scope.signAllTransactions,
    });
  }

  public logAndCreateError(...args: (string | number | Record<string, any>)[]): void {
    const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg)).join(", ");
    this.logger.error(message);
    throw new Error(message);
  }

  public checkDisabled(): void {
    if (this.disabled || !this.scope) this.logAndCreateError("module not working");
  }
}
