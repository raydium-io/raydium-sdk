import { PublicKey } from '@solana/web3.js';

declare function getAssociatedMiddleStatusAccount({ programId, fromPoolId, middleMint, owner, }: {
    programId: PublicKey;
    fromPoolId: PublicKey;
    middleMint: PublicKey;
    owner: PublicKey;
}): Promise<PublicKey>;

export { getAssociatedMiddleStatusAccount };
