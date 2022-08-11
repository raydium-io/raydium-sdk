import { Logger } from "pino";

import { createLogger } from "../common/logger";
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

  public logAndCreateError(...args: (string | number | Record<string, any>)[]): Error {
    const message = args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg)).join(", ");
    this.logger.error(message);
    return new Error(message);
  }

  public checkDisabled(): void {
    if (this.disabled || !this.scope) this.logAndCreateError("module not working");
  }
}
