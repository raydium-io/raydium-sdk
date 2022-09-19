import { PublicKey } from '@solana/web3.js';
import { PublicKeyish } from '../common/pubKey.js';

/**
 * A token is any fungible financial instrument on Solana, including SOL and all SPL tokens.
 */
interface TokenProps {
    mint: PublicKeyish;
    decimals: number;
    symbol?: string;
    name?: string;
    skipMint?: boolean;
}
declare class Token {
    readonly symbol?: string;
    readonly name?: string;
    readonly decimals: number;
    readonly mint: PublicKey;
    static readonly WSOL: Token;
    /**
     *
     * @param mint - pass "sol" as mint will auto generate wsol token config
     */
    constructor({ mint, decimals, symbol, name, skipMint }: TokenProps);
    equals(other: Token): boolean;
}

export { Token, TokenProps };
