import { AmmSource } from '../liquidity/type.js';
import '@solana/web3.js';
import 'bn.js';
import '../../type-665453b6.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../../bignumber-cbebe552.js';
import '../../module/token.js';
import '../../common/pubKey.js';
import '../token/type.js';
import '../../common/logger.js';
import 'pino';
import '../account/types.js';
import '../account/layout.js';
import '../../common/accountInfo.js';

declare function groupPools(pools: AmmSource[]): AmmSource[][];

export { groupPools };
