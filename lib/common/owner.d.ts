import { PublicKey, Signer, Keypair } from '@solana/web3.js';

declare type _Owner = Keypair | PublicKey;
declare class Owner {
    private readonly _owner;
    constructor(owner: _Owner);
    get publicKey(): PublicKey;
    get signer(): Signer | undefined;
    get isKeyPair(): boolean;
    get isPublicKey(): boolean;
    static isKeyPair(owner: _Owner): owner is Keypair;
    static isPublicKey(owner: _Owner): owner is PublicKey;
}

export { Owner };
