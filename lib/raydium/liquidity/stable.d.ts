import { Structure } from '../../marshmallow/index.js';
import * as BN from 'bn.js';
import { PublicKey, Connection } from '@solana/web3.js';
import '../../marshmallow/buffer-layout.js';

declare const MODEL_DATA_PUBKEY: PublicKey;
declare const DataElement: Structure<BN, "", {
    x: BN;
    y: BN;
    price: BN;
}>;
declare const modelDataInfoLayout: Structure<BN | {
    x: BN;
    y: BN;
    price: BN;
}[], "", {
    status: BN;
    accountType: BN;
    multiplier: BN;
    validDataCount: BN;
    DataElement: {
        x: BN;
        y: BN;
        price: BN;
    }[];
}>;
interface StableModelLayout {
    accountType: number;
    status: number;
    multiplier: number;
    validDataCount: number;
    DataElement: {
        x: number;
        y: number;
        price: number;
    }[];
}
declare function getDyByDxBaseIn(layoutData: StableModelLayout, xReal: number, yReal: number, dxReal: number): number;
declare function getDxByDyBaseIn(layoutData: StableModelLayout, xReal: number, yReal: number, dyReal: number): number;
declare function formatLayout(buffer: Buffer): StableModelLayout;
declare function getStablePrice(layoutData: StableModelLayout, coinReal: number, pcReal: number, baseCoin: boolean): number;
declare class StableLayout {
    private readonly connection;
    private _layoutData;
    constructor({ connection }: {
        connection: Connection;
    });
    get stableModelData(): StableModelLayout;
    initStableModelLayout(): Promise<void>;
}

export { DataElement, MODEL_DATA_PUBKEY, StableLayout, StableModelLayout, formatLayout, getDxByDyBaseIn, getDyByDxBaseIn, getStablePrice, modelDataInfoLayout };
