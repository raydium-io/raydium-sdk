import { Connection, Keypair } from "@solana/web3.js";
import consola from "consola";
import dotenv from "dotenv";

import { jsonInfo2PoolKeys } from "../../src/common";
import { Currency, CurrencyAmount, Percent, Token, TokenAmount } from "../../src/entity";
import { Liquidity, LiquidityPoolInfo } from "../../src/liquidity";
import { Spl } from "../../src/spl";

dotenv.config();

describe("Test Liquidity.", () => {
  // SOL-USDC
  const config = {
    id: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
    baseMint: "So11111111111111111111111111111111111111112",
    quoteMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    lpMint: "8HoQnePLqPj4M7PUDzfw8e3Ymdwgc7NLGnaTUapubyvu",
    version: 4,
    programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    authority: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    openOrders: "HRk9CMrpq7Jn9sh7mzxE8CChHG8dneX9p475QKz4Fsfc",
    targetOrders: "CZza3Ej4Mc58MnxWA385itCC9jCo3L1D7zc3LKy1bZMR",
    baseVault: "DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz",
    quoteVault: "HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz",
    withdrawQueue: "G7xeGGLevkRwB5f44QNgQtrPKBdMfkT6ZZwpS9xcC97n",
    lpVault: "Awpt6N7ZYPBa4vG4BQNFhFxDj4sxExAA9rpBAoBw2uok",
    marketVersion: 3,
    marketProgramId: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    marketId: "9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT",
    marketAuthority: "F8Vyqk3unwxkXukZFQeYyGmFfTG3CAX4v24iyrjEYBJV",
    marketBaseVault: "36c6YqAwyGKQG66XEp2dJc5JqjaBNv7sVghEtJv4c7u6",
    marketQuoteVault: "8CFo8bL8mZQK8abbFyypFMwEDd8tVJjHTTojMLgQTUSZ",
    marketBids: "14ivtgssEBoBjuZJtSAPKYgpUK7DmnSwuPMqJoVTSgKJ",
    marketAsks: "CEQdAFKdycHugujQg9k2wbmxjcpdYZyVLfV9WerTnafJ",
    marketEventQueue: "5KKsLVU6TcbVDK4BS6K1DGDxnh4Q9xjYJ8XaDCG5t8ht",
  };
  const poolKeys = jsonInfo2PoolKeys(config);

  const endpoint = process.env.RPC_ENDPOINT;
  const privateKey = process.env.PRIVATE_KEY;
  if (!endpoint) {
    consola.error("RPC_ENDPOINT not set on .env file.");
    process.exit(1);
  }
  if (!privateKey) {
    consola.error("PRIVATE_KEY not set on .env file.");
    process.exit(1);
  }

  const connection = new Connection(endpoint);
  const wallet = Keypair.fromSecretKey(new Uint8Array(privateKey.split(",").map((k) => parseInt(k))));

  let poolInfo: LiquidityPoolInfo;

  beforeEach(async () => {
    poolInfo = await Liquidity.fetchInfo({ connection, poolKeys });
  });

  it("should works when makeAddLiquidityTransaction fixed base", async () => {
    const { quoteMint, lpMint } = poolKeys;
    const { quoteDecimals } = poolInfo;

    const currencyAmount = new CurrencyAmount(Currency.SOL, 10);
    const anotherCurrency = new Token(quoteMint, quoteDecimals);

    const { maxAnotherCurrencyAmount } = Liquidity.computeAnotherCurrencyAmount({
      poolKeys,
      poolInfo,
      currencyAmount,
      anotherCurrency,
      slippage: new Percent(0),
    });
    console.log(maxAnotherCurrencyAmount.toExact());

    const { transaction, signers } = await Liquidity.makeAddLiquidityTransaction({
      connection,
      poolKeys,
      userKeys: {
        tokenAccountB: await Spl.getAssociatedTokenAccount({ mint: quoteMint, owner: wallet.publicKey }),
        lpTokenAccount: await Spl.getAssociatedTokenAccount({ mint: lpMint, owner: wallet.publicKey }),
        owner: wallet.publicKey,
      },
      currencyAmountInA: currencyAmount,
      currencyAmountInB: maxAnotherCurrencyAmount,
      fixedSide: "a",
    });

    const txid = await connection.sendTransaction(transaction, [wallet, ...signers]);

    console.log(txid);
  });

  it("should works when makeAddLiquidityTransaction fixed quote", async () => {
    const { quoteMint, lpMint } = poolKeys;
    const { quoteDecimals } = poolInfo;

    const currencyAmount = new TokenAmount(new Token(quoteMint, quoteDecimals), 10);
    const anotherCurrency = Currency.SOL;

    const { maxAnotherCurrencyAmount } = Liquidity.computeAnotherCurrencyAmount({
      poolKeys,
      poolInfo,
      currencyAmount,
      anotherCurrency,
      slippage: new Percent(0),
    });
    console.log(maxAnotherCurrencyAmount.toExact());

    const { transaction, signers } = await Liquidity.makeAddLiquidityTransaction({
      connection,
      poolKeys,
      userKeys: {
        tokenAccountA: await Spl.getAssociatedTokenAccount({ mint: quoteMint, owner: wallet.publicKey }),
        lpTokenAccount: await Spl.getAssociatedTokenAccount({ mint: lpMint, owner: wallet.publicKey }),
        owner: wallet.publicKey,
      },
      currencyAmountInA: currencyAmount,
      currencyAmountInB: maxAnotherCurrencyAmount,
      fixedSide: "a",
    });

    const txid = await connection.sendTransaction(transaction, [wallet, ...signers]);

    console.log(txid);
  });

  it("should works when makeRemoveLiquidityTransaction", async () => {
    const { quoteMint, lpMint } = poolKeys;
    const { lpDecimals } = poolInfo;

    const amount = new TokenAmount(new Token(lpMint, lpDecimals), 100);

    const { transaction, signers } = await Liquidity.makeRemoveLiquidityTransaction({
      connection,
      poolKeys,
      userKeys: {
        lpTokenAccount: await Spl.getAssociatedTokenAccount({ mint: lpMint, owner: wallet.publicKey }),
        quoteTokenAccount: await Spl.getAssociatedTokenAccount({ mint: quoteMint, owner: wallet.publicKey }),
        owner: wallet.publicKey,
      },
      tokenAmountIn: amount,
    });

    const txid = await connection.sendTransaction(transaction, [wallet, ...signers]);

    console.log(txid);
  });
});
