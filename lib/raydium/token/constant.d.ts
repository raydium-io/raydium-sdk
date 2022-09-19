import { PublicKey } from '@solana/web3.js';
import { NativeTokenInfo, SplTokenInfo } from './type.js';
import '../../module/token.js';
import '../../common/pubKey.js';

declare const TOKEN_SOL: NativeTokenInfo;
declare const TOKEN_WSOL: SplTokenInfo;
declare const quantumSOLHydratedTokenJsonInfo: {
    isQuantumSOL: boolean;
    isLp: boolean;
    official: boolean;
    mint: PublicKey;
    decimals: number;
    symbol: string;
    id: string;
    name: string;
    icon: string;
    extensions: {
        coingeckoId: string;
    };
};

export { TOKEN_SOL, TOKEN_WSOL, quantumSOLHydratedTokenJsonInfo };
