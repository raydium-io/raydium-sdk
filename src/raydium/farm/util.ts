import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { GetMultipleAccountsInfoConfig, getMultipleAccountsInfoWithCustomFlags } from "../../common/accountInfo";
import { parseBigNumberish } from "../../common/bignumber";
import { createLogger } from "../../common/logger";
import { PublicKeyish, tryParsePublicKey, validateAndParsePublicKey } from "../../common/pubKey";
import { findProgramAddress, ProgramAddress } from "../../common/txTool";
import { splAccountLayout } from "../account/layout";
import { SplAccount } from "../account/types";

import {
  FARM_PROGRAMID_TO_VERSION,
  FARM_VERSION_TO_LEDGER_LAYOUT,
  FARM_VERSION_TO_PROGRAMID,
  FARM_VERSION_TO_STATE_LAYOUT,
  FarmVersion,
} from "./config";
import { FarmLedger, FarmLedgerLayout, FarmState, FarmStateLayout } from "./layout";
import { FarmPoolJsonInfo, FarmPoolKeys, FarmRewardInfo, FarmRewardInfoConfig, SdkParsedFarmInfo } from "./type";

const logger = createLogger("Raydium.farm.util");
interface AssociatedLedgerPoolAccount {
  programId: PublicKey;
  poolId: PublicKey;
  mint: PublicKey;
  type: "lpVault" | "rewardVault";
}

export async function getAssociatedLedgerPoolAccount({
  programId,
  poolId,
  mint,
  type,
}: AssociatedLedgerPoolAccount): Promise<PublicKey> {
  const { publicKey } = await findProgramAddress(
    [
      poolId.toBuffer(),
      mint.toBuffer(),
      Buffer.from(
        type === "lpVault" ? "lp_vault_associated_seed" : type === "rewardVault" ? "reward_vault_associated_seed" : "",
        "utf-8",
      ),
    ],
    programId,
  );
  return publicKey;
}

export function getFarmVersion(programId: PublicKeyish): FarmVersion {
  const programIdPubKey = validateAndParsePublicKey(programId);
  const programIdString = programIdPubKey.toBase58();

  const version = FARM_PROGRAMID_TO_VERSION[programIdString];

  return version;
}

export async function getAssociatedLedgerAccount({
  programId,
  poolId,
  owner,
}: {
  programId: PublicKey;
  poolId: PublicKey;
  owner: PublicKey;
}): Promise<PublicKey> {
  const { publicKey } = await findProgramAddress(
    [
      poolId.toBuffer(),
      owner.toBuffer(),
      Buffer.from(
        getFarmVersion(programId) === 6 ? "farmer_info_associated_seed" : "staker_info_v2_associated_seed",
        "utf-8",
      ),
    ],
    programId,
  );
  return publicKey;
}

export const getAssociatedAuthority = async ({
  programId,
  poolId,
}: {
  programId: PublicKey;
  poolId: PublicKey;
}): Promise<ProgramAddress> => await findProgramAddress([poolId.toBuffer()], programId);

export function getFarmProgramId(version: number): PublicKey | undefined {
  const programId = FARM_VERSION_TO_PROGRAMID[version];

  return programId;
}

export function farmRewardInfoToConfig(data: FarmRewardInfo): FarmRewardInfoConfig {
  return {
    isSet: new BN(1),
    rewardPerSecond: parseBigNumberish(data.rewardPerSecond),
    rewardOpenTime: parseBigNumberish(data.rewardOpenTime),
    rewardEndTime: parseBigNumberish(data.rewardEndTime),
  };
}

export function calFarmRewardAmount(data: FarmRewardInfo): BN {
  return parseBigNumberish(data.rewardEndTime)
    .sub(parseBigNumberish(data.rewardOpenTime))
    .mul(parseBigNumberish(data.rewardPerSecond));
}

export function getFarmLedgerLayout(version: number): FarmLedgerLayout | undefined {
  const ledgerLayout = FARM_VERSION_TO_LEDGER_LAYOUT[version];
  if (!ledgerLayout) logger.logWithError("invalid version", version);
  return ledgerLayout;
}

export function getFarmStateLayout(version: number): FarmStateLayout | undefined {
  const stateLayout = FARM_VERSION_TO_STATE_LAYOUT[version];
  if (!stateLayout) logger.logWithError("invalid version", version);
  return stateLayout;
}

export function updateFarmPoolInfo(
  poolInfo: FarmState,
  lpVault: SplAccount,
  slot: number,
  chainTime: number,
): FarmState {
  if (poolInfo.version === 3 || poolInfo.version === 5) {
    if (poolInfo.lastSlot.gte(new BN(slot))) return poolInfo;

    const spread = new BN(slot).sub(poolInfo.lastSlot);
    poolInfo.lastSlot = new BN(slot);

    for (const itemRewardInfo of poolInfo.rewardInfos) {
      if (lpVault.amount.eq(new BN(0))) continue;

      const reward = itemRewardInfo.perSlotReward.mul(spread);
      itemRewardInfo.perShareReward = itemRewardInfo.perShareReward.add(
        reward.mul(new BN(10).pow(new BN(poolInfo.version === 3 ? 9 : 15))).div(lpVault.amount),
      );
      itemRewardInfo.totalReward = itemRewardInfo.totalReward.add(reward);
    }
  } else if (poolInfo.version === 6) {
    for (const itemRewardInfo of poolInfo.rewardInfos) {
      if (itemRewardInfo.rewardState.eq(new BN(0))) continue;
      const updateTime = BN.min(new BN(chainTime), itemRewardInfo.rewardEndTime);
      if (itemRewardInfo.rewardOpenTime.gte(updateTime)) continue;
      const spread = updateTime.sub(itemRewardInfo.rewardLastUpdateTime);
      let reward = spread.mul(itemRewardInfo.rewardPerSecond);
      const leftReward = itemRewardInfo.totalReward.sub(itemRewardInfo.totalRewardEmissioned);
      if (leftReward.lt(reward)) {
        reward = leftReward;
        itemRewardInfo.rewardLastUpdateTime = itemRewardInfo.rewardLastUpdateTime.add(
          leftReward.div(itemRewardInfo.rewardPerSecond),
        );
      } else {
        itemRewardInfo.rewardLastUpdateTime = updateTime;
      }
      if (lpVault.amount.eq(new BN(0))) continue;
      itemRewardInfo.accRewardPerShare = itemRewardInfo.accRewardPerShare.add(
        reward.mul(poolInfo.rewardMultiplier).div(lpVault.amount),
      );
      itemRewardInfo.totalRewardEmissioned = itemRewardInfo.totalRewardEmissioned.add(reward);
    }
  }
  return poolInfo;
}

interface FarmPoolsInfo {
  [id: string]: {
    state: FarmState;
    lpVault: SplAccount;
    ledger?: FarmLedger;
    wrapped?: { pendingRewards: BN[] };
  };
}

export interface FarmFetchMultipleInfoParams {
  connection: Connection;
  pools: FarmPoolKeys[];
  owner?: PublicKey;
  config?: GetMultipleAccountsInfoConfig;
}

export async function fetchMultipleFarmInfoAndUpdate({
  connection,
  pools,
  owner,
  config,
}: FarmFetchMultipleInfoParams): Promise<FarmPoolsInfo> {
  let hasNotV6Pool = false;
  let hasV6Pool = false;
  const tenBN = new BN(10);

  const publicKeys: {
    pubkey: PublicKey;
    version: number;
    key: "state" | "lpVault" | "ledger";
    poolId: PublicKey;
  }[] = [];

  for (const pool of pools) {
    if (pool.version === 6) hasV6Pool = true;
    else hasNotV6Pool = true;

    publicKeys.push(
      {
        pubkey: pool.id,
        version: pool.version,
        key: "state",
        poolId: pool.id,
      },
      {
        pubkey: pool.lpVault,
        version: pool.version,
        key: "lpVault",
        poolId: pool.id,
      },
    );

    if (owner) {
      publicKeys.push({
        pubkey: await getAssociatedLedgerAccount({ programId: pool.programId, poolId: pool.id, owner }),
        version: pool.version,
        key: "ledger",
        poolId: pool.id,
      });
    }
  }

  const poolsInfo: FarmPoolsInfo = {};

  const accountsInfo = await getMultipleAccountsInfoWithCustomFlags(connection, publicKeys, config);
  for (const { pubkey, version, key, poolId, accountInfo } of accountsInfo) {
    const _poolId = poolId.toBase58();

    if (key === "state") {
      const stateLayout = getFarmStateLayout(version);
      if (!accountInfo || !accountInfo.data || accountInfo.data.length !== stateLayout!.span) {
        logger.logWithError(`invalid farm state account info, pools.id, ${pubkey}`);
      }

      poolsInfo[_poolId] = {
        ...poolsInfo[_poolId],
        ...{ state: stateLayout!.decode(accountInfo!.data) },
      };
    } else if (key === "lpVault") {
      if (!accountInfo || !accountInfo.data || accountInfo.data.length !== splAccountLayout.span) {
        logger.logWithError(`invalid farm lp vault account info, pools.lpVault, ${pubkey}`);
      }

      poolsInfo[_poolId] = {
        ...poolsInfo[_poolId],
        ...{ lpVault: splAccountLayout.decode(accountInfo!.data) },
      };
    } else if (key === "ledger") {
      const legerLayout = getFarmLedgerLayout(version)!;
      if (accountInfo && accountInfo.data) {
        if (accountInfo.data.length !== legerLayout.span) {
          logger.logWithError(`invalid farm ledger account info, ledger, ${pubkey}`);
        }

        poolsInfo[_poolId] = {
          ...poolsInfo[_poolId],
          ...{ ledger: legerLayout.decode(accountInfo.data) },
        };
      }
    }
  }

  const slot = hasV6Pool || hasNotV6Pool ? await connection.getSlot() : 0;
  const chainTime = hasV6Pool ? (await connection.getBlockTime(slot)) ?? 0 : 0;

  for (const poolId of Object.keys(poolsInfo)) {
    poolsInfo[poolId].state = updateFarmPoolInfo(poolsInfo[poolId].state, poolsInfo[poolId].lpVault, slot, chainTime);
  }

  for (const [poolId, { state, ledger }] of Object.entries(poolsInfo)) {
    if (ledger) {
      const multiplier =
        state.version === 6
          ? state.rewardMultiplier
          : state.rewardInfos.length === 1
          ? tenBN.pow(new BN(9))
          : tenBN.pow(new BN(15));

      const pendingRewards = state.rewardInfos.map((rewardInfo, index) => {
        const rewardDebt = ledger.rewardDebts[index];
        const pendingReward = ledger.deposited
          .mul(state.version === 6 ? rewardInfo.accRewardPerShare : rewardInfo.perShareReward)
          .div(multiplier)
          .sub(rewardDebt);

        return pendingReward;
      });

      poolsInfo[poolId].wrapped = {
        ...poolsInfo[poolId].wrapped,
        pendingRewards,
      };
    }
  }

  return poolsInfo;
}

/** and state info  */
export async function mergeSdkFarmInfo(
  options: FarmFetchMultipleInfoParams,
  payload: {
    jsonInfos: FarmPoolJsonInfo[];
  },
): Promise<SdkParsedFarmInfo[]> {
  const rawInfos = await fetchMultipleFarmInfoAndUpdate(options);
  const result = options.pools.map(
    (pool, idx) =>
      ({
        ...payload.jsonInfos[idx],
        ...pool,
        ...rawInfos[String(pool.id)],
        jsonInfo: payload.jsonInfos[idx],
      } as unknown as SdkParsedFarmInfo),
  );
  return result;
}
