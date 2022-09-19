import { PublicKey, Connection } from '@solana/web3.js';
import BN__default from 'bn.js';
import { GetMultipleAccountsInfoConfig } from '../../common/accountInfo.js';
import { PublicKeyish } from '../../common/pubKey.js';
import { ProgramAddress } from '../../common/txTool.js';
import { DateParam } from '../../common/date.js';
import { SplAccount } from '../account/types.js';
import { ah as FarmVersion, a0 as FarmRewardInfo, a1 as FarmRewardInfoConfig, P as FarmLedgerLayout, C as FarmStateLayout, B as FarmState, $ as FarmPoolJsonInfo, a8 as SdkParsedFarmInfo, W as FarmLedger } from '../../type-bcca4bc0.js';
import { T as TokenAmount, w as Price, F as Fraction } from '../../bignumber-2daa5944.js';
import { Token } from '../../module/token.js';
import '../../common/owner.js';
import '../../marshmallow/index.js';
import '../../marshmallow/buffer-layout.js';
import '../token/type.js';
import '../../common/logger.js';
import '../account/layout.js';

interface AssociatedLedgerPoolAccount {
    programId: PublicKey;
    poolId: PublicKey;
    mint: PublicKey;
    type: "lpVault" | "rewardVault";
}
declare function getAssociatedLedgerPoolAccount({ programId, poolId, mint, type, }: AssociatedLedgerPoolAccount): Promise<PublicKey>;
declare function getFarmVersion(programId: PublicKeyish): FarmVersion;
declare function getAssociatedLedgerAccount({ programId, poolId, owner, }: {
    programId: PublicKey;
    poolId: PublicKey;
    owner: PublicKey;
}): Promise<PublicKey>;
declare const getAssociatedAuthority: ({ programId, poolId, }: {
    programId: PublicKey;
    poolId: PublicKey;
}) => Promise<ProgramAddress>;
declare function getFarmProgramId(version: number): PublicKey | undefined;
declare function farmRewardInfoToConfig(data: FarmRewardInfo): FarmRewardInfoConfig;
declare function calFarmRewardAmount(data: FarmRewardInfo): BN__default;
declare function getFarmLedgerLayout(version: number): FarmLedgerLayout | undefined;
declare function getFarmStateLayout(version: number): FarmStateLayout | undefined;
declare function updateFarmPoolInfo(poolInfo: FarmState, lpVault: SplAccount, slot: number, chainTime: number): FarmState;
interface FarmPoolsInfo {
    [id: string]: {
        state: FarmState;
        lpVault: SplAccount;
        ledger?: FarmLedger;
        wrapped?: {
            pendingRewards: BN__default[];
        };
    };
}
interface FarmFetchMultipleInfoParams {
    connection: Connection;
    farmPools: FarmPoolJsonInfo[];
    owner?: PublicKey;
    config?: GetMultipleAccountsInfoConfig;
}
declare function fetchMultipleFarmInfoAndUpdate({ connection, farmPools, owner, config, }: FarmFetchMultipleInfoParams): Promise<FarmPoolsInfo>;
/** and state info  */
declare function mergeSdkFarmInfo(options: FarmFetchMultipleInfoParams): Promise<SdkParsedFarmInfo[]>;
declare function judgeFarmType(info: SdkParsedFarmInfo, currentTime?: DateParam): "closed pool" | "normal fusion pool" | "dual fusion pool" | undefined | "upcoming pool";
declare function whetherIsStakeFarmPool(info: SdkParsedFarmInfo): boolean;
declare function calculateFarmPoolAprList(info: SdkParsedFarmInfo, payload: {
    currentBlockChainDate: Date;
    blockSlotCountForSecond: number;
    tvl: TokenAmount | undefined;
    rewardTokens: (Token | undefined)[];
    rewardTokenPrices: (Price | undefined)[];
}): (Fraction | undefined)[];

export { FarmFetchMultipleInfoParams, calFarmRewardAmount, calculateFarmPoolAprList, farmRewardInfoToConfig, fetchMultipleFarmInfoAndUpdate, getAssociatedAuthority, getAssociatedLedgerAccount, getAssociatedLedgerPoolAccount, getFarmLedgerLayout, getFarmProgramId, getFarmStateLayout, getFarmVersion, judgeFarmType, mergeSdkFarmInfo, updateFarmPoolInfo, whetherIsStakeFarmPool };
