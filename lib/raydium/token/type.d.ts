import { TokenProps } from '../../module/token.js';
import '@solana/web3.js';
import '../../common/pubKey.js';

declare type ExtensionKey = "coingeckoId" | "website" | "whitepaper";
declare type Extensions = {
    [key in ExtensionKey]?: string;
};
interface NativeTokenInfo {
    readonly symbol: string;
    readonly name: string;
    readonly decimals: number;
}
interface SplTokenInfo extends NativeTokenInfo {
    readonly mint: string;
    readonly extensions: Extensions;
}
interface TokenJson {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    extensions: {
        coingeckoId?: string;
    };
    icon: string;
}
declare type SplToken = TokenProps & {
    icon: string;
    id: string;
    extensions: {
        [key in "coingeckoId" | "website" | "whitepaper"]?: string;
    };
    userAdded?: boolean;
};

export { ExtensionKey, Extensions, NativeTokenInfo, SplToken, SplTokenInfo, TokenJson };
