import { Commitment, Connection, PublicKey, AccountInfo } from '@solana/web3.js';

interface GetMultipleAccountsInfoConfig {
    batchRequest?: boolean;
    commitment?: Commitment;
}
declare function getMultipleAccountsInfo(connection: Connection, publicKeys: PublicKey[], config?: GetMultipleAccountsInfoConfig): Promise<(AccountInfo<Buffer> | null)[]>;
declare function getMultipleAccountsInfoWithCustomFlags<T extends {
    pubkey: PublicKey;
}>(connection: Connection, publicKeysWithCustomFlag: T[], config?: GetMultipleAccountsInfoConfig): Promise<({
    accountInfo: AccountInfo<Buffer> | null;
} & T)[]>;

export { GetMultipleAccountsInfoConfig, getMultipleAccountsInfo, getMultipleAccountsInfoWithCustomFlags };
