import { Raydium } from "../raydium";

export default class Module {
  public scope: Raydium;
  private disabled = false;

  constructor(scope: Raydium) {
    this.scope = scope;
  }

  public checkDisabled(): void {
    if (this.disabled || !this.scope) throw new Error("module not working");
  }
}
