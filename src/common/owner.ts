import { Keypair, PublicKey, Signer } from "@solana/web3.js";

type _Owner = Keypair | PublicKey;

export class Owner {
  private readonly _owner: _Owner;

  constructor(owner: _Owner) {
    this._owner = owner;
  }

  get publicKey(): PublicKey {
    if (Owner.isKeyPair(this._owner)) {
      return this._owner.publicKey;
    }

    return this._owner;
  }

  get signer(): Signer | undefined {
    return Owner.isKeyPair(this._owner) ? this._owner : undefined;
  }

  get isKeyPair(): boolean {
    return Owner.isKeyPair(this._owner);
  }

  get isPublicKey(): boolean {
    return Owner.isPublicKey(this._owner);
  }

  static isKeyPair(owner: _Owner): owner is Keypair {
    return (owner as Keypair).secretKey !== undefined;
  }

  static isPublicKey(owner: _Owner): owner is PublicKey {
    return !Owner.isKeyPair(owner);
  }
}
