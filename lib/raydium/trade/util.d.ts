import { AmmSource } from '../liquidity/type.js';
import '@solana/web3.js';
import 'bn.js';
import '../../type-9c271374.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../../bignumber-2daa5944.js';
import '../../module/token.js';
import '../../common/pubKey.js';
import '../token/type.js';
import '../../common/logger.js';
import '../account/types.js';
import '../account/layout.js';
import '../../common/accountInfo.js';

declare function groupPools(pools: AmmSource[]): AmmSource[][];

export { groupPools };
