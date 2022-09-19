import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import {
  AccountMeta,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";

import { accountMeta, AddInstructionParam, commonSystemAccountMeta, TxBuilder } from "../../common";
import { isDateAfter, isDateBefore, offsetDateTime } from "../../common/date";
import { getMax, sub, isMeaningfulNumber } from "../../common/fractionUtil";
import {
  BigNumberish,
  toTotalPrice,
  toPercent,
  toBN,
  parseNumberInfo,
  parseBigNumberish,
} from "../../common/bignumber";
import { PublicKeyish, SOLMint, validateAndParsePublicKey } from "../../common/pubKey";
import { Fraction } from "../../module/fraction";
import { Token as RToken } from "../../module/token";
import { TokenAmount } from "../../module/amount";
import { createWSolAccountInstructions } from "../account/instruction";
import ModuleBase from "../moduleBase";
import { TOKEN_WSOL } from "../token/constant";
import { LoadParams, MakeTransaction } from "../type";

import {
  FARM_LOCK_MINT,
  FARM_LOCK_VAULT,
  farmDespotVersionToInstruction,
  farmWithdrawVersionToInstruction,
  isValidFarmVersion,
  poolTypeV6,
  validateFarmRewards,
} from "./config";
import { createAssociatedLedgerAccountInstruction, makeCreateFarmInstruction } from "./instruction";
import {
  dwLayout,
  farmAddRewardLayout,
  farmRewardRestartLayout,
  farmStateV6Layout,
  withdrawRewardLayout,
} from "./layout";
import {
  CreateFarm,
  FarmDWParam,
  FarmPoolJsonInfo,
  FarmRewardInfo,
  FarmRewardInfoConfig,
  RewardInfoKey,
  SdkParsedFarmInfo,
  UpdateFarmReward,
  HydratedFarmInfo,
} from "./type";
import {
  calFarmRewardAmount,
  farmRewardInfoToConfig,
  getAssociatedAuthority,
  getAssociatedLedgerAccount,
  getAssociatedLedgerPoolAccount,
  getFarmProgramId,
  mergeSdkFarmInfo,
  judgeFarmType,
  whetherIsStakeFarmPool,
  calculateFarmPoolAprList,
} from "./util";

export default class Farm extends ModuleBase {
  private _farmPools: FarmPoolJsonInfo[] = [];
  private _hydratedFarmPools: HydratedFarmInfo[] = [];
  private _hydratedFarmMap: Map<string, HydratedFarmInfo> = new Map();
  private _sdkParsedFarmPools: SdkParsedFarmInfo[] = [];
  private _lpTokenInfoMap: Map<string, RToken> = new Map();

  public async load(params?: LoadParams): Promise<void> {
    await this.scope.liquidity.load(params);
    await this.scope.fetchFarms(params?.forceUpdate);

    const data = this.scope.apiData.farmPools?.data || {};

    this._farmPools = Object.keys(data || {}).reduce(
      (acc, cur) =>
        acc.concat(
          data[cur].map?.((data: FarmPoolJsonInfo) => {
            const baseToken = this.scope.token.allTokenMap.get(data.baseMint);
            const quoteToken = this.scope.token.allTokenMap.get(data.quoteMint);
            if (baseToken && quoteToken) {
              this._lpTokenInfoMap.set(
                data.lpMint,
                new RToken({
                  mint: data.lpMint,
                  decimals: baseToken.decimals,
                  symbol: `${baseToken.symbol} - ${quoteToken.name}`,
                  name: `${baseToken.symbol} - ${quoteToken.name} LP`,
                }),
              );
            }

            return { ...data, name: data.symbol, category: cur };
          }) || [],
        ),
      [],
    );
    await this.fetchSdkFarmInfo();
  }

  public async fetchSdkFarmInfo(): Promise<void> {
    this._sdkParsedFarmPools = await mergeSdkFarmInfo({
      connection: this.scope.connection,
      farmPools: this._farmPools,
      owner: this.scope.owner?.publicKey,
      config: { commitment: "confirmed" },
    });
  }

  public async loadHydratedFarmInfo(params?: LoadParams & { skipPrice?: boolean }): Promise<HydratedFarmInfo[]> {
    const { forceUpdate, skipPrice } = params || {};
    if (this._hydratedFarmPools.length && !forceUpdate) return this._hydratedFarmPools;
    await this.scope.farm.load();
    try {
      await this.scope.account.fetchWalletTokenAccounts();
    } catch {
      //
    }
    !skipPrice && (await this.scope.token.fetchTokenPrices());
    await this.scope.liquidity.loadPairs();
    const chainTimeOffset = await this.scope.chainTimeOffset();
    const currentBlockChainDate = offsetDateTime(Date.now() + chainTimeOffset, { minutes: 0 /* force */ });
    const blockSlotCountForSecond = await this.scope.api.getBlockSlotCountForSecond(this.scope.connection.rpcEndpoint);

    const farmAprs = Object.fromEntries(
      this.scope.liquidity.allPairs.map((i) => [i.ammId, { apr30d: i.apr30d, apr7d: i.apr7d, apr24h: i.apr24h }]),
    );

    this._hydratedFarmPools = this._sdkParsedFarmPools.map((farmInfo) => {
      const info = this.hydrateFarmInfo({
        farmInfo,
        blockSlotCountForSecond,
        farmAprs,
        currentBlockChainDate, // same as chainTimeOffset
        chainTimeOffset, // same as currentBlockChainDate
      });
      this._hydratedFarmMap.set(farmInfo.id.toBase58(), info);
      return info;
    });
    return this._hydratedFarmPools;
  }

  get allFarms(): FarmPoolJsonInfo[] {
    return this._farmPools;
  }
  get allParsedFarms(): SdkParsedFarmInfo[] {
    return this._sdkParsedFarmPools;
  }
  get allHydratedFarms(): HydratedFarmInfo[] {
    return this._hydratedFarmPools;
  }
  get allHydratedFarmMap(): Map<string, HydratedFarmInfo> {
    return this._hydratedFarmMap;
  }

  public getFarm(farmId: PublicKeyish): FarmPoolJsonInfo {
    const _farmId = validateAndParsePublicKey({ publicKey: farmId });
    const farmInfo = this.allFarms.find((farm) => farm.id === _farmId.toBase58());
    if (!farmInfo) this.logAndCreateError("invalid farm id");
    return farmInfo!;
  }
  public getParsedFarm(farmId: PublicKeyish): SdkParsedFarmInfo {
    const _farmId = validateAndParsePublicKey({ publicKey: farmId });
    const farmInfo = this.allParsedFarms.find((farm) => _farmId.equals(farm.id));
    if (!farmInfo) this.logAndCreateError("invalid farm id");
    return farmInfo!;
  }
  public getLpTokenInfo(lpMint: PublicKeyish): RToken {
    const pubKey = validateAndParsePublicKey({ publicKey: lpMint });
    const lpToken = this._lpTokenInfoMap.get(pubKey.toBase58());
    if (!lpToken) this.logAndCreateError("LP Token not found", pubKey.toBase58());
    return lpToken!;
  }
  public lpDecimalAmount({ mint, amount }: { mint: PublicKeyish; amount: BigNumberish }): BN {
    const numberDetails = parseNumberInfo(amount);
    const token = this.getLpTokenInfo(mint);
    return toBN(
      new Fraction(numberDetails.numerator, numberDetails.denominator).mul(new BN(10).pow(new BN(token.decimals))),
    );
  }

  public hydrateFarmInfo(params: {
    farmInfo: SdkParsedFarmInfo;
    blockSlotCountForSecond: number;
    farmAprs: Record<string, { apr30d: number; apr7d: number; apr24h: number }>; // from api:pairs
    currentBlockChainDate: Date;
    chainTimeOffset: number;
  }): HydratedFarmInfo {
    const { farmInfo, blockSlotCountForSecond, farmAprs, currentBlockChainDate, chainTimeOffset = 0 } = params;
    const farmPoolType = judgeFarmType(farmInfo, currentBlockChainDate);
    const isStakePool = whetherIsStakeFarmPool(farmInfo);
    const isDualFusionPool = farmPoolType === "dual fusion pool";
    const isNormalFusionPool = farmPoolType === "normal fusion pool";
    const isClosedPool = farmPoolType === "closed pool" && !farmInfo.upcoming; // NOTE: I don't know why, but Amanda says there is a bug.
    const isUpcomingPool = farmInfo.version !== 6 ? farmInfo.upcoming && isClosedPool : farmInfo.upcoming;
    const isNewPool = farmInfo.version !== 6 && farmInfo.upcoming && !isClosedPool; // NOTE: Rudy says!!!
    const isStablePool =
      this.scope.liquidity.allPools.find((i) => i.lpMint === farmInfo.lpMint.toBase58())?.version === 5;

    const lpToken = isStakePool ? this.scope.mintToToken(farmInfo.lpMint) : this.getLpTokenInfo(farmInfo.lpMint);
    const baseToken = this.scope.mintToToken(isStakePool ? farmInfo.lpMint : farmInfo.baseMint);
    const quoteToken = this.scope.mintToToken(isStakePool ? farmInfo.lpMint : farmInfo.quoteMint);

    if (!baseToken?.symbol) {
      // console.log('farmInfo: ', farmInfo.jsonInfo)
    }
    const name = isStakePool
      ? `${baseToken?.symbol ?? "unknown"}`
      : `${baseToken?.symbol ?? "unknown"}-${quoteToken?.symbol ?? "unknown"}`;

    const rewardTokens = farmInfo.jsonInfo.rewardInfos.map(({ rewardMint: mint }) => this.scope.mintToToken(mint));
    const pendingRewards = farmInfo.wrapped?.pendingRewards.map((reward, idx) =>
      rewardTokens[idx] ? new TokenAmount(rewardTokens[idx]!, toBN(getMax(reward, 0))) : undefined,
    );

    const lpPrice = isStakePool
      ? this.scope.token.tokenPrices.get(farmInfo.lpMint.toBase58())!
      : this.scope.liquidity.lpPriceMap.get(farmInfo.lpMint.toBase58())!;

    const stakedLpAmount = lpToken && new TokenAmount(lpToken, farmInfo.lpVault.amount);
    const tvl =
      lpPrice && lpToken ? toTotalPrice(new TokenAmount(lpToken, farmInfo.lpVault.amount), lpPrice) : undefined;

    const aprs = calculateFarmPoolAprList(farmInfo, {
      tvl,
      currentBlockChainDate,
      rewardTokens,
      rewardTokenPrices:
        farmInfo.rewardInfos.map(({ rewardMint }) => this.scope.token.tokenPrices.get(rewardMint.toBase58())) ?? [],
      blockSlotCountForSecond,
    });

    const ammId = this.scope.liquidity.allPools.find((pool) => pool.lpMint === farmInfo.lpMint.toBase58())?.id;
    const raydiumFeeApr7d = ammId ? toPercent(farmAprs[ammId]?.apr7d, { alreadyDecimaled: true }) : undefined;
    const raydiumFeeApr30d = ammId ? toPercent(farmAprs[ammId]?.apr30d, { alreadyDecimaled: true }) : undefined;
    const raydiumFeeApr24h = ammId ? toPercent(farmAprs[ammId]?.apr24h, { alreadyDecimaled: true }) : undefined;
    const totalApr7d = aprs.reduce((acc, cur) => (acc ? (cur ? acc.add(cur) : acc) : cur), raydiumFeeApr7d);
    const totalApr30d = aprs.reduce((acc, cur) => (acc ? (cur ? acc.add(cur) : acc) : cur), raydiumFeeApr30d);
    const totalApr24h = aprs.reduce((acc, cur) => (acc ? (cur ? acc.add(cur) : acc) : cur), raydiumFeeApr24h);

    const rewards =
      farmInfo.version === 6
        ? (farmInfo.state.rewardInfos
            .map((rewardInfo, idx) => {
              const { rewardOpenTime: openTime, rewardEndTime: endTime, rewardPerSecond } = rewardInfo;
              const rewardOpenTime = openTime.toNumber()
                ? new Date(openTime.toNumber() * 1000 + chainTimeOffset)
                : undefined; // chain time
              const rewardEndTime = endTime.toNumber()
                ? new Date(endTime.toNumber() * 1000 + chainTimeOffset)
                : undefined; // chain time
              const onlineCurrentDate = Date.now() + chainTimeOffset;
              if (!rewardOpenTime && !rewardEndTime) return undefined; // if reward is not any state, return undefined to delete it
              const token = this.scope.mintToToken(
                (rewardInfo.rewardMint ?? farmInfo.rewardInfos[idx]?.rewardMint)?.toBase58(),
              );
              const isRewardBeforeStart = Boolean(rewardOpenTime && isDateBefore(onlineCurrentDate, rewardOpenTime));
              const isRewardEnded = Boolean(rewardEndTime && isDateAfter(onlineCurrentDate, rewardEndTime));
              const isRewarding = (!rewardOpenTime && !rewardEndTime) || (!isRewardEnded && !isRewardBeforeStart);
              const isRwardingBeforeEnd72h =
                isRewarding &&
                isDateAfter(
                  onlineCurrentDate,
                  offsetDateTime(rewardEndTime, { seconds: -(farmInfo.jsonInfo.rewardPeriodExtend ?? 72 * 60 * 60) }),
                );
              const claimableRewards =
                token &&
                this.scope.mintToTokenAmount({
                  mint: token.mint,
                  amount: sub(rewardInfo.totalReward, rewardInfo.totalRewardEmissioned)!.toFixed(token.decimals),
                });

              const pendingReward = pendingRewards?.[idx];
              const apr = aprs[idx];
              const usedTohaveReward = Boolean(rewardEndTime);
              const jsonRewardInfo = farmInfo.rewardInfos[idx];

              return {
                ...jsonRewardInfo,
                ...rewardInfo,
                owner: jsonRewardInfo?.rewardSender,
                apr,
                token,
                userPendingReward: pendingReward,
                userHavedReward: usedTohaveReward,
                perSecond:
                  token && this.scope.mintToTokenAmount({ mint: token.mint, amount: rewardPerSecond }).toSignificant(),
                openTime: rewardOpenTime,
                endTime: rewardEndTime,
                isOptionToken: rewardInfo.rewardType === "Option tokens",
                isRewardBeforeStart,
                isRewardEnded,
                isRewarding,
                isRwardingBeforeEnd72h,
                claimableRewards,
                version: 6,
              };
            })
            .filter((data) => !!data) as HydratedFarmInfo["rewards"])
        : farmInfo.state.rewardInfos.map((rewardInfo, idx) => {
            const pendingReward = pendingRewards?.[idx];
            const apr = aprs[idx];
            const token = rewardTokens[idx];
            const { perSlotReward } = rewardInfo;

            const usedTohaveReward = isMeaningfulNumber(pendingReward) || isMeaningfulNumber(perSlotReward);
            return {
              ...rewardInfo,
              apr,
              token,
              userPendingReward: pendingReward,
              userHavedReward: usedTohaveReward,
              version: farmInfo.version,
            };
          });
    const userStakedLpAmount =
      lpToken && farmInfo.ledger?.deposited ? new TokenAmount(lpToken, farmInfo.ledger?.deposited) : undefined;

    return {
      ...farmInfo,
      lp: lpToken,
      lpPrice,
      base: baseToken,
      quote: quoteToken,
      name,
      isStakePool,
      isDualFusionPool,
      isNormalFusionPool,
      isClosedPool,
      isUpcomingPool,
      isStablePool,
      isNewPool,
      totalApr7d,
      raydiumFeeApr7d,
      totalApr24h,
      raydiumFeeApr24h,
      totalApr30d,
      raydiumFeeApr30d,
      ammId,
      tvl,
      userHasStaked: isMeaningfulNumber(userStakedLpAmount),
      rewards,
      userStakedLpAmount,
      stakedLpAmount,
    };
  }

  // token account needed
  private async _getUserRewardInfo({ payer, rewardInfo }: { payer: PublicKey; rewardInfo: FarmRewardInfo }): Promise<{
    rewardPubKey?: PublicKey;
    newInstruction?: AddInstructionParam;
  }> {
    if (rewardInfo.rewardMint.equals(SOLMint)) {
      const txInstructions = await createWSolAccountInstructions({
        connection: this.scope.connection,
        owner: this.scope.ownerPubKey,
        payer,
        amount: calFarmRewardAmount(rewardInfo),
      });
      return {
        rewardPubKey: txInstructions.signers![0].publicKey,
        newInstruction: txInstructions,
      };
    }

    return {
      rewardPubKey: await this.scope.account.getCreatedTokenAccount({
        mint: rewardInfo.rewardMint,
      })!,
    };
  }

  // token account needed
  public async create({ poolId, rewardInfos, payer }: CreateFarm): Promise<MakeTransaction> {
    this.checkDisabled();
    this.scope.checkOwner();

    const poolPubkey = validateAndParsePublicKey({ publicKey: poolId });
    const poolJsonInfo = this.scope.liquidity.allPools.find((j) => j.id === poolPubkey.toBase58());
    if (!poolJsonInfo) this.logAndCreateError("invalid pool id");

    const lpMint = new PublicKey(poolJsonInfo!.lpMint);
    const poolInfo = {
      lpMint,
      lockInfo: { lockMint: FARM_LOCK_MINT, lockVault: FARM_LOCK_VAULT },
      version: 6,
      rewardInfos,
      programId: getFarmProgramId(6)!,
    };

    const txBuilder = this.createTxBuilder();
    const payerPubKey = payer ?? this.scope.ownerPubKey;
    const farmKeyPair = Keypair.generate();
    const lamports = await this.scope.connection.getMinimumBalanceForRentExemption(farmStateV6Layout.span);

    txBuilder.addInstruction({
      instructions: [
        SystemProgram.createAccount({
          fromPubkey: payerPubKey,
          newAccountPubkey: farmKeyPair.publicKey,
          lamports,
          space: farmStateV6Layout.span,
          programId: poolInfo.programId,
        }),
      ],
      signers: [farmKeyPair],
    });

    const { publicKey: authority, nonce } = await getAssociatedAuthority({
      programId: poolInfo.programId,
      poolId: farmKeyPair.publicKey,
    });

    const lpVault = await getAssociatedLedgerPoolAccount({
      programId: poolInfo.programId,
      poolId: farmKeyPair.publicKey,
      mint: poolInfo.lpMint,
      type: "lpVault",
    });

    const rewardInfoConfig: FarmRewardInfoConfig[] = [];
    const rewardInfoKey: RewardInfoKey[] = [];

    for (const rewardInfo of poolInfo.rewardInfos) {
      if (rewardInfo.rewardOpenTime >= rewardInfo.rewardEndTime)
        this.logAndCreateError("start time error", "rewardInfo.rewardOpenTime", rewardInfo.rewardOpenTime.toString());
      if (!poolTypeV6[rewardInfo.rewardType]) this.logAndCreateError("rewardType error", rewardInfo.rewardType);
      if (rewardInfo.rewardPerSecond <= 0)
        this.logAndCreateError("rewardPerSecond error", rewardInfo.rewardPerSecond.toString());

      rewardInfoConfig.push(farmRewardInfoToConfig(rewardInfo));

      const { rewardPubKey, newInstruction } = await this._getUserRewardInfo({
        rewardInfo,
        payer: payerPubKey,
      });
      if (newInstruction) txBuilder.addInstruction(newInstruction);

      if (!rewardPubKey) this.logAndCreateError("cannot found target token accounts", this.scope.account.tokenAccounts);

      const rewardMint = rewardInfo.rewardMint.equals(SOLMint) ? new PublicKey(TOKEN_WSOL.mint) : rewardInfo.rewardMint;
      rewardInfoKey.push({
        rewardMint,
        rewardVault: await getAssociatedLedgerPoolAccount({
          programId: poolInfo.programId,
          poolId: farmKeyPair.publicKey,
          mint: rewardMint,
          type: "rewardVault",
        }),
        userRewardToken: rewardPubKey!,
      });
    }

    const lockUserAccount = await this.scope.account.getCreatedTokenAccount({
      mint: poolInfo.lockInfo.lockMint,
    });

    if (!lockUserAccount)
      this.logAndCreateError("cannot found lock vault", "tokenAccounts", this.scope.account.tokenAccounts);

    const createInstruction = makeCreateFarmInstruction({
      farmKeyPair,
      owner: this.scope.ownerPubKey,
      farmAuthority: authority,
      lpVault,
      lpMint: poolInfo.lpMint,
      lockVault: poolInfo.lockInfo.lockVault,
      lockMint: poolInfo.lockInfo.lockMint,
      lockUserAccount,
      programId: poolInfo.programId,
      rewardInfo: rewardInfoKey,
      rewardInfoConfig,
      nonce,
    });

    return await txBuilder
      .addInstruction({
        instructions: [createInstruction],
      })
      .build();
  }

  // token account needed
  public async restartReward({ farmId, payer, newRewardInfo }: UpdateFarmReward): Promise<MakeTransaction> {
    const farmInfo = this.getFarm(farmId)!;
    if (farmInfo!.version !== 6) this.logAndCreateError("invalid farm version", farmInfo!.version);

    const poolKeys = {
      id: new PublicKey(farmInfo.id),
      rewardInfos: farmInfo.rewardInfos,
      lpVault: new PublicKey(farmInfo.lpVault),
      programId: new PublicKey(farmInfo.programId),
    };

    if (newRewardInfo.rewardOpenTime >= newRewardInfo.rewardEndTime)
      this.logAndCreateError("start time error", "newRewardInfo", newRewardInfo);

    const payerPubKey = payer || this.scope.ownerPubKey;

    const rewardMint = newRewardInfo.rewardMint.equals(SOLMint)
      ? new PublicKey(TOKEN_WSOL.mint)
      : newRewardInfo.rewardMint;
    const rewardInfo = poolKeys.rewardInfos.find((item) => new PublicKey(item.rewardMint).equals(rewardMint));

    if (!rewardInfo) this.logAndCreateError("configuration does not exist", "rewardMint", rewardMint);

    const rewardVault = rewardInfo!.rewardVault ? new PublicKey(rewardInfo!.rewardVault) : SOLMint;
    const txBuilder = this.createTxBuilder();

    const { rewardPubKey: userRewardTokenPub, newInstruction } = await this._getUserRewardInfo({
      rewardInfo: newRewardInfo,
      payer: payerPubKey,
    });
    if (newInstruction) txBuilder.addInstruction(newInstruction);

    if (!userRewardTokenPub)
      this.logAndCreateError("cannot found target token accounts", this.scope.account.tokenAccounts);

    const data = Buffer.alloc(farmRewardRestartLayout.span);
    farmRewardRestartLayout.encode(
      {
        instruction: 3,
        rewardReopenTime: parseBigNumberish(newRewardInfo.rewardOpenTime),
        rewardEndTime: parseBigNumberish(newRewardInfo.rewardEndTime),
        rewardPerSecond: parseBigNumberish(newRewardInfo.rewardPerSecond),
      },
      data,
    );

    const keys = [
      accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
      accountMeta({ pubkey: poolKeys.id }),
      accountMeta({ pubkey: poolKeys.lpVault, isWritable: false }),
      accountMeta({ pubkey: rewardVault }),
      accountMeta({ pubkey: userRewardTokenPub! }),
      accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
    ];

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: poolKeys.programId, keys, data })],
      })
      .build();
  }

  // token account needed
  public async addNewRewardToken(params: UpdateFarmReward): Promise<MakeTransaction> {
    const { farmId, newRewardInfo, payer } = params;
    const farmInfo = this.getFarm(farmId)!;
    if (farmInfo!.version !== 6) this.logAndCreateError("invalid farm version", farmInfo!.version);
    const payerPubKey = payer ?? this.scope.ownerPubKey;
    const txBuilder = this.createTxBuilder();

    const rewardVault = await getAssociatedLedgerPoolAccount({
      programId: new PublicKey(farmInfo.programId),
      poolId: new PublicKey(farmInfo.id),
      mint: newRewardInfo.rewardMint,
      type: "rewardVault",
    });

    const { rewardPubKey: userRewardTokenPub, newInstruction } = await this._getUserRewardInfo({
      rewardInfo: newRewardInfo,
      payer: payerPubKey,
    });
    if (newInstruction) txBuilder.addInstruction(newInstruction);

    if (!userRewardTokenPub)
      this.logAndCreateError("annot found target token accounts", this.scope.account.tokenAccounts);

    const rewardMint = newRewardInfo.rewardMint.equals(SOLMint)
      ? new PublicKey(TOKEN_WSOL.mint)
      : newRewardInfo.rewardMint;
    const data = Buffer.alloc(farmAddRewardLayout.span);
    farmAddRewardLayout.encode(
      {
        instruction: 4,
        isSet: new BN(1),
        rewardPerSecond: parseBigNumberish(newRewardInfo.rewardPerSecond),
        rewardOpenTime: parseBigNumberish(newRewardInfo.rewardOpenTime),
        rewardEndTime: parseBigNumberish(newRewardInfo.rewardEndTime),
      },
      data,
    );

    const keys = [
      ...commonSystemAccountMeta,
      accountMeta({ pubkey: new PublicKey(farmInfo.id) }),
      accountMeta({ pubkey: new PublicKey(farmInfo.authority), isWritable: false }),
      accountMeta({ pubkey: rewardMint, isWritable: false }),
      accountMeta({ pubkey: rewardVault }),
      accountMeta({ pubkey: userRewardTokenPub! }),
      accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
    ];

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: new PublicKey(farmInfo.programId), keys, data })],
      })
      .build();
  }

  private async _prepareFarmAccounts(params: { mint: PublicKey; farmInfo: SdkParsedFarmInfo }): Promise<{
    txBuilder: TxBuilder;
    lpTokenAccount: PublicKey;
    ledgerAddress: PublicKey;
    rewardTokenAccountsPublicKeys: PublicKey[];
    lowVersionKeys: AccountMeta[];
  }> {
    const txBuilder = this.createTxBuilder();
    const { farmInfo } = params;

    const { pubKey: lpTokenAccount, newInstructions } = await this.scope.account.checkOrCreateAta({
      mint: farmInfo.lpMint,
    });
    txBuilder.addInstruction(newInstructions);

    const rewardTokenAccountsPublicKeys = await Promise.all(
      farmInfo.rewardInfos.map(async ({ rewardMint }) => {
        const { pubKey, newInstructions } = await this.scope.account.checkOrCreateAta({
          mint: rewardMint,
          autoUnwrapWSOLToSOL: true,
        });
        txBuilder.addInstruction(newInstructions);
        return pubKey;
      }),
    );

    const ledgerAddress = await getAssociatedLedgerAccount({
      programId: new PublicKey(farmInfo.programId),
      poolId: new PublicKey(farmInfo.id),
      owner: this.scope.ownerPubKey,
    });

    if (!farmInfo.ledger && farmInfo.version < 6 /* start from v6, no need init ledger any more */) {
      const instruction = await createAssociatedLedgerAccountInstruction({
        id: farmInfo.id,
        programId: farmInfo.programId,
        version: farmInfo.version,
        ledger: ledgerAddress,
        owner: this.scope.ownerPubKey,
      });
      txBuilder.addInstruction({ instructions: [instruction] });
    }

    const lowVersionKeys = [
      accountMeta({ pubkey: farmInfo.id }),
      accountMeta({ pubkey: farmInfo.authority, isWritable: false }),
      accountMeta({ pubkey: ledgerAddress }),
      accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
      accountMeta({ pubkey: lpTokenAccount }),
      accountMeta({ pubkey: new PublicKey(farmInfo.jsonInfo.lpVault) }),
      accountMeta({ pubkey: rewardTokenAccountsPublicKeys[0] }),
      accountMeta({ pubkey: farmInfo.rewardInfos[0].rewardVault }),
      accountMeta({ pubkey: SYSVAR_CLOCK_PUBKEY, isWritable: false }),
      accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
    ];

    return { txBuilder, lpTokenAccount, rewardTokenAccountsPublicKeys, ledgerAddress, lowVersionKeys };
  }

  public async deposit(params: FarmDWParam): Promise<MakeTransaction> {
    this.scope.checkOwner();
    const { farmId, amount } = params;
    const farmInfo = this.getParsedFarm(farmId)!;
    const mint = farmInfo.lpMint;
    const { version, rewardInfos } = farmInfo;
    if (!isValidFarmVersion(version)) this.logAndCreateError("invalid farm version:", version);

    const { txBuilder, ledgerAddress, lpTokenAccount, lowVersionKeys, rewardTokenAccountsPublicKeys } =
      await this._prepareFarmAccounts({ mint, farmInfo });

    const errorMsg = validateFarmRewards({
      version,
      rewardInfos,
      rewardTokenAccountsPublicKeys,
    });
    if (errorMsg) this.logAndCreateError(errorMsg);

    const data = Buffer.alloc(dwLayout.span);
    dwLayout.encode(
      {
        instruction: farmDespotVersionToInstruction(version),
        amount: parseBigNumberish(amount),
      },
      data,
    );

    const keys =
      version === 6
        ? [
            accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
            accountMeta({ pubkey: SystemProgram.programId, isWritable: false }),
            accountMeta({ pubkey: farmInfo.id }),
            accountMeta({ pubkey: farmInfo.authority, isWritable: false }),
            accountMeta({ pubkey: farmInfo.lpVault.mint }),
            accountMeta({ pubkey: ledgerAddress }),
            accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
            accountMeta({ pubkey: lpTokenAccount }),
          ]
        : lowVersionKeys;

    if (version !== 3) {
      for (let index = 1; index < rewardInfos.length; index++) {
        keys.push(accountMeta({ pubkey: rewardTokenAccountsPublicKeys[index] }));
        keys.push(accountMeta({ pubkey: rewardInfos[index].rewardVault }));
      }
    }

    const newInstruction = new TransactionInstruction({ programId: farmInfo.programId, keys, data });

    return await txBuilder
      .addInstruction({
        instructions: [newInstruction],
      })
      .build();
  }

  public async withdraw(params: FarmDWParam): Promise<MakeTransaction> {
    this.scope.checkOwner();
    const { farmId, amount } = params;
    const farmInfo = this.getParsedFarm(farmId)!;
    const mint = farmInfo.lpMint;
    const { version, rewardInfos } = farmInfo;
    if (!isValidFarmVersion(version)) this.logAndCreateError("invalid farm version:", version);
    const { txBuilder, ledgerAddress, lpTokenAccount, lowVersionKeys, rewardTokenAccountsPublicKeys } =
      await this._prepareFarmAccounts({ mint, farmInfo });

    const data = Buffer.alloc(dwLayout.span);
    dwLayout.encode(
      {
        instruction: farmWithdrawVersionToInstruction(version),
        amount: parseBigNumberish(amount),
      },
      data,
    );

    const keys =
      version === 6
        ? [
            accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
            accountMeta({ pubkey: farmInfo.id }),
            accountMeta({ pubkey: farmInfo.authority, isWritable: false }),
            accountMeta({ pubkey: farmInfo.lpVault.mint }),
            accountMeta({ pubkey: ledgerAddress }),
            accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
            accountMeta({ pubkey: lpTokenAccount }),
          ]
        : lowVersionKeys;

    if (version !== 3) {
      for (let index = 1; index < rewardInfos.length; index++) {
        keys.push(accountMeta({ pubkey: rewardTokenAccountsPublicKeys[index] }));
        keys.push(accountMeta({ pubkey: rewardInfos[index].rewardVault }));
      }
    }
    const newInstruction = new TransactionInstruction({ programId: farmInfo.programId, keys, data });
    return await txBuilder
      .addInstruction({
        instructions: [newInstruction],
      })
      .build();
  }

  // token account needed
  public async withdrawFarmReward({
    farmId,
    withdrawMint,
  }: {
    farmId: PublicKey;
    withdrawMint: PublicKey;
    payer?: PublicKey;
  }): Promise<MakeTransaction> {
    this.scope.checkOwner();
    const farmInfo = this.getParsedFarm(farmId);
    const { version } = farmInfo;
    if (version !== 6) this.logAndCreateError("invalid farm version", farmInfo!.version);

    const rewardInfo = farmInfo.rewardInfos.find((item) =>
      item.rewardMint.equals(withdrawMint.equals(SOLMint) ? new PublicKey(TOKEN_WSOL.mint) : withdrawMint),
    );
    if (!rewardInfo) this.logAndCreateError("withdraw mint error", "rewardInfos", farmInfo);

    const rewardVault = rewardInfo?.rewardVault ?? SOLMint;
    const txBuilder = this.createTxBuilder();

    let userRewardToken: PublicKey;
    this._getUserRewardInfo({
      payer: this.scope.ownerPubKey,
      rewardInfo: rewardInfo!,
    });

    if (withdrawMint.equals(SOLMint)) {
      const txInstruction = await createWSolAccountInstructions({
        connection: this.scope.connection,
        owner: this.scope.ownerPubKey,
        payer: this.scope.ownerPubKey,
        amount: calFarmRewardAmount(rewardInfo!),
      });
      userRewardToken = txInstruction.signers![0].publicKey;
      txBuilder.addInstruction(txInstruction);
    } else {
      const selectUserRewardToken = await this.scope.account.getCreatedTokenAccount({
        mint: withdrawMint,
      });

      if (selectUserRewardToken === null) {
        userRewardToken = await this.scope.account.getAssociatedTokenAccount(withdrawMint);
        txBuilder.addInstruction({
          instructions: [
            createAssociatedTokenAccountInstruction(
              this.scope.ownerPubKey,
              userRewardToken,
              this.scope.ownerPubKey,
              withdrawMint,
            ),
          ],
        });
      } else {
        userRewardToken = selectUserRewardToken!;
      }
    }

    const data = Buffer.alloc(withdrawRewardLayout.span);
    withdrawRewardLayout.encode({ instruction: 5 }, data);

    const keys = [
      accountMeta({ pubkey: TOKEN_PROGRAM_ID, isWritable: false }),
      accountMeta({ pubkey: farmInfo.id }),
      accountMeta({ pubkey: farmInfo.authority, isWritable: false }),
      accountMeta({ pubkey: farmInfo.lpVault.mint, isWritable: false }),
      accountMeta({ pubkey: rewardVault }),
      accountMeta({ pubkey: userRewardToken }),
      accountMeta({ pubkey: this.scope.ownerPubKey, isWritable: false, isSigner: true }),
    ];

    return await txBuilder
      .addInstruction({
        instructions: [new TransactionInstruction({ programId: farmInfo.programId, keys, data })],
      })
      .build();
  }
}
