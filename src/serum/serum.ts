import { PublicKey } from "@solana/web3.js";
import { Logger, PublicKeyIsh, validateAndParsePublicKey } from "../common";
import { SERUM_PROGRAMID_TO_VERSION, SERUM_VERSION_TO_PROGRAMID } from "./id";
import { MARKET_VERSION_TO_STATE_LAYOUT } from "./layout";

const logger = new Logger("Serum");

export class Market {
  /* ================= static functions ================= */
  static getProgramId(version: number) {
    const programId = SERUM_VERSION_TO_PROGRAMID[version];
    if (!programId) {
      return logger.throwArgumentError("invalid version", "version", version);
    }

    return new PublicKey(programId);
  }

  static getVersion(programId: PublicKeyIsh) {
    const programIdPubKey = validateAndParsePublicKey(programId);
    const programIdString = programIdPubKey.toBase58();

    const version = SERUM_PROGRAMID_TO_VERSION[programIdString];
    if (!version) {
      return logger.throwArgumentError("invalid program id", "programId", programIdString);
    }

    return version;
  }

  static getLayout(params: { version?: number; programId?: PublicKeyIsh }) {
    let version = 0;

    if (params.programId) {
      version = this.getVersion(params.programId);
    }

    if (params.version) {
      version = params.version;
    }

    const STATE_LAYOUT = MARKET_VERSION_TO_STATE_LAYOUT[version];
    if (!STATE_LAYOUT) {
      return logger.throwArgumentError("invalid params", "params", params);
    }

    return { state: STATE_LAYOUT };
  }

  static async getVaultSigner({ programId, marketId }: { programId: PublicKey; marketId: PublicKey }) {
    const seeds = [marketId.toBuffer()];

    let nonce = 0;
    let address: PublicKey;

    while (nonce < 100) {
      try {
        // Buffer.alloc(7) nonce u64
        const seedsWithNonce = seeds.concat(Buffer.from([nonce]), Buffer.alloc(7));
        address = await PublicKey.createProgramAddress(seedsWithNonce, programId);
      } catch (err) {
        if (err instanceof TypeError) {
          throw err;
        }
        nonce++;
        continue;
      }
      return address;
    }

    return logger.throwArgumentError("unable to find a viable program address nonce", "params", {
      programId: programId.toBase58(),
      marketId: marketId.toBase58(),
    });
  }
}
