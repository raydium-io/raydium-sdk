import { Token } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

import { Base } from "../base";
import { SYSVAR_RENT_PUBKEY, TOKEN_PROGRAM_ID } from "../common";
import { ZERO } from "../entity";
import { blob, publicKey, struct, u16, u32, u64, u8, WideBits } from "../marshmallow";

function accountFlagsLayout(property = 'accountFlags') {
  const ACCOUNT_FLAGS_LAYOUT = new WideBits(property);
  ACCOUNT_FLAGS_LAYOUT.addBoolean('initialized');
  ACCOUNT_FLAGS_LAYOUT.addBoolean('market');
  ACCOUNT_FLAGS_LAYOUT.addBoolean('openOrders');
  ACCOUNT_FLAGS_LAYOUT.addBoolean('requestQueue');
  ACCOUNT_FLAGS_LAYOUT.addBoolean('eventQueue');
  ACCOUNT_FLAGS_LAYOUT.addBoolean('bids');
  ACCOUNT_FLAGS_LAYOUT.addBoolean('asks');
  return ACCOUNT_FLAGS_LAYOUT;
}

export const MARKET_STATE_LAYOUT_V2 = struct([
  blob(5),
  accountFlagsLayout('accountFlags'),
  publicKey('ownAddress'),
  u64('vaultSignerNonce'),
  publicKey('baseMint'),
  publicKey('quoteMint'),
  publicKey('baseVault'),
  u64('baseDepositsTotal'),
  u64('baseFeesAccrued'),
  publicKey('quoteVault'),
  u64('quoteDepositsTotal'),
  u64('quoteFeesAccrued'),
  u64('quoteDustThreshold'),
  publicKey('requestQueue'),
  publicKey('eventQueue'),
  publicKey('bids'),
  publicKey('asks'),
  u64('baseLotSize'),
  u64('quoteLotSize'),
  u64('feeRateBps'),
  u64('referrerRebatesAccrued'),
  blob(7),
]);

export class MarketV2 extends Base {

  static async makeCreateMarketTransaction({
    connection,
    wallet,
    baseInfo,
    quoteInfo,
    lotSize, // 1
    tickSize, // 0.01
    dexProgramId,
  }: {
    connection: Connection;
    wallet: PublicKey;
    baseInfo: {
      mint: PublicKey,
      decimals: number
    };
    quoteInfo: {
      mint: PublicKey,
      decimals: number
    };
    lotSize: number;
    tickSize: number;
    dexProgramId: PublicKey;
  }) {
    const market = Keypair.generate();
    const requestQueue = Keypair.generate();
    const eventQueue = Keypair.generate();
    const bids = Keypair.generate();
    const asks = Keypair.generate();
    const baseVault = Keypair.generate();
    const quoteVault = Keypair.generate();
    const feeRateBps = 0;
    const quoteDustThreshold = new BN(100);

    function getVaultOwnerAndNonce() {
      const vaultSignerNonce = new BN(0);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const vaultOwner = PublicKey.createProgramAddressSync(
            [market.publicKey.toBuffer(), vaultSignerNonce.toArrayLike(Buffer, 'le', 8)],
            dexProgramId,
          );
          return { vaultOwner, vaultSignerNonce };
        } catch (e) {
          vaultSignerNonce.iaddn(1);
          if (vaultSignerNonce.gt(new BN(25555))) throw Error('find vault owner error')
        }
      }
    }
    const { vaultOwner, vaultSignerNonce } = getVaultOwnerAndNonce();

    const baseLotSize = new BN(Math.round(10 ** baseInfo.decimals * lotSize));
    const quoteLotSize = new BN(Math.round(lotSize * 10 ** quoteInfo.decimals * tickSize));

    if (baseLotSize.eq(ZERO)) throw Error('lot size is too small')
    if (quoteLotSize.eq(ZERO)) throw Error('tick size or lot size is too small')

    return {
      transactions: await this.makeCreateMarketInstruction({
        connection, wallet, marketInfo: {
          programId: dexProgramId,
          id: market,
          baseMint: baseInfo.mint,
          quoteMint: quoteInfo.mint,
          baseVault,
          quoteVault,
          vaultOwner,
          requestQueue,
          eventQueue,
          bids,
          asks,

          feeRateBps,
          quoteDustThreshold,
          vaultSignerNonce,
          baseLotSize,
          quoteLotSize
        }
      }),
      address: {
        id: market.publicKey
      }
    }
  }

  static async makeCreateMarketInstruction({ connection, wallet, marketInfo }: {
    connection: Connection,
    wallet: PublicKey
    marketInfo: {
      programId: PublicKey
      id: Keypair,
      baseMint: PublicKey,
      quoteMint: PublicKey,
      baseVault: Keypair,
      quoteVault: Keypair,
      vaultOwner: PublicKey

      requestQueue: Keypair,
      eventQueue: Keypair,
      bids: Keypair,
      asks: Keypair,

      feeRateBps: number,
      vaultSignerNonce: BN,
      quoteDustThreshold: BN,

      baseLotSize: BN,
      quoteLotSize: BN,
    }
  }) {
    const tx1 = new Transaction();
    tx1.add(
      SystemProgram.createAccount({
        fromPubkey: wallet,
        newAccountPubkey: marketInfo.baseVault.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(165),
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet,
        newAccountPubkey: marketInfo.quoteVault.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(165),
        space: 165,
        programId: TOKEN_PROGRAM_ID,
      }),
      Token.createInitAccountInstruction(
        TOKEN_PROGRAM_ID,
        marketInfo.baseMint,
        marketInfo.baseVault.publicKey,
        marketInfo.vaultOwner,
      ),
      Token.createInitAccountInstruction(
        TOKEN_PROGRAM_ID,
        marketInfo.quoteMint,
        marketInfo.quoteVault.publicKey,
        marketInfo.vaultOwner,
      ),
    );

    const tx2 = new Transaction();
    tx2.add(
      SystemProgram.createAccount({
        fromPubkey: wallet,
        newAccountPubkey: marketInfo.id.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(MARKET_STATE_LAYOUT_V2.span),
        space: MARKET_STATE_LAYOUT_V2.span,
        programId: marketInfo.programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet,
        newAccountPubkey: marketInfo.requestQueue.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(5120 + 12),
        space: 5120 + 12,
        programId: marketInfo.programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet,
        newAccountPubkey: marketInfo.eventQueue.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(262144 + 12),
        space: 262144 + 12,
        programId: marketInfo.programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet,
        newAccountPubkey: marketInfo.bids.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(65536 + 12),
        space: 65536 + 12,
        programId: marketInfo.programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: wallet,
        newAccountPubkey: marketInfo.asks.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(65536 + 12),
        space: 65536 + 12,
        programId: marketInfo.programId,
      }),
      this.initializeMarket({
        programId: marketInfo.programId,
        marketInfo: {
          id: marketInfo.id.publicKey,
          requestQueue: marketInfo.requestQueue.publicKey,
          eventQueue: marketInfo.eventQueue.publicKey,
          bids: marketInfo.bids.publicKey,
          asks: marketInfo.asks.publicKey,
          baseVault: marketInfo.baseVault.publicKey,
          quoteVault: marketInfo.quoteVault.publicKey,
          baseMint: marketInfo.baseMint,
          quoteMint: marketInfo.quoteMint,

          baseLotSize: marketInfo.baseLotSize,
          quoteLotSize: marketInfo.quoteLotSize,
          feeRateBps: marketInfo.feeRateBps,
          vaultSignerNonce: marketInfo.vaultSignerNonce,
          quoteDustThreshold: marketInfo.quoteDustThreshold,
        }
      }),
    );

    return [
      { transaction: tx1, signer: [marketInfo.baseVault, marketInfo.quoteVault] },
      {
        transaction: tx2,
        signer: [marketInfo.id, marketInfo.requestQueue, marketInfo.eventQueue, marketInfo.bids, marketInfo.asks],
      },
    ]
  }

  static initializeMarket({ programId, marketInfo }: {
    programId: PublicKey,
    marketInfo: {
      id: PublicKey,
      requestQueue: PublicKey,
      eventQueue: PublicKey,
      bids: PublicKey,
      asks: PublicKey,
      baseVault: PublicKey,
      quoteVault: PublicKey,
      baseMint: PublicKey,
      quoteMint: PublicKey,
      authority?: PublicKey
      pruneAuthority?: PublicKey,

      baseLotSize: BN,
      quoteLotSize: BN,
      feeRateBps: number,
      vaultSignerNonce: BN,
      quoteDustThreshold: BN,
    }
  }) {
    const dataLayout = struct([
      u8('version'),
      u32("instruction"),
      u64('baseLotSize'),
      u64('quoteLotSize'),
      u16('feeRateBps'),
      u64('vaultSignerNonce'),
      u64('quoteDustThreshold'),
    ]);

    const keys = [
      { pubkey: marketInfo.id, isSigner: false, isWritable: true },
      { pubkey: marketInfo.requestQueue, isSigner: false, isWritable: true },
      { pubkey: marketInfo.eventQueue, isSigner: false, isWritable: true },
      { pubkey: marketInfo.bids, isSigner: false, isWritable: true },
      { pubkey: marketInfo.asks, isSigner: false, isWritable: true },
      { pubkey: marketInfo.baseVault, isSigner: false, isWritable: true },
      { pubkey: marketInfo.quoteVault, isSigner: false, isWritable: true },
      { pubkey: marketInfo.baseMint, isSigner: false, isWritable: false },
      { pubkey: marketInfo.quoteMint, isSigner: false, isWritable: false },
      // Use a dummy address if using the new dex upgrade to save tx space.
      {
        pubkey: marketInfo.authority ? marketInfo.quoteMint : SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
    ]
      .concat(marketInfo.authority
        ? { pubkey: marketInfo.authority, isSigner: false, isWritable: false }
        : [])
      .concat(marketInfo.authority && marketInfo.pruneAuthority
        ? { pubkey: marketInfo.pruneAuthority, isSigner: false, isWritable: false }
        : []);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        version: 0,
        instruction: 0,
        baseLotSize: marketInfo.baseLotSize,
        quoteLotSize: marketInfo.quoteLotSize,
        feeRateBps: marketInfo.feeRateBps,
        vaultSignerNonce: marketInfo.vaultSignerNonce,
        quoteDustThreshold: marketInfo.quoteDustThreshold,
      },
      data
    );


    return new TransactionInstruction({
      keys,
      programId,
      data,
    });
  }
}