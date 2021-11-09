import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Logger } from "./logger";

const logger = new Logger("Common");

// const PACKET_DATA_SIZE = 1280 - 40 - 8;

/**
 * Forecast transaction size
 */
export function forecastTransactionSize(instructions: TransactionInstruction[], signers: PublicKey[]) {
  if (instructions.length < 1) {
    return logger.throwArgumentError("no instructions provided", "instructions", instructions);
  }
  if (signers.length < 1) {
    return logger.throwArgumentError("no signers provided", "signers", signers);
  }

  const transaction = new Transaction({
    recentBlockhash: "11111111111111111111111111111111",
    feePayer: signers[0],
  });

  transaction.add(...instructions);

  const message = transaction.compileMessage().serialize();
  // SIGNATURE_LENGTH = 64
  const transactionLength = signers.length + signers.length * 64 + message.length;

  return transactionLength;
}
