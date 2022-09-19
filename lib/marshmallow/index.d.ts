import { PublicKey } from '@solana/web3.js';
import BN__default from 'bn.js';
import { Layout, UInt, Structure as Structure$1, Union as Union$1, Blob } from './buffer-layout.js';
export { BitStructure, Blob, GetStructureSchema, Layout, LayoutConstructor, UInt, bits, blob, cstr, f32, f32be, f64, f64be, greedy, ns64, ns64be, nu64, nu64be, offset, s16, s16be, s24, s24be, s32, s32be, s40, s40be, s48, s48be, s8, u16, u16be, u24, u24be, u32be, u40, u40be, u48, u48be, unionLayoutDiscriminator, utf8 } from './buffer-layout.js';

declare class BNLayout<P extends string = ""> extends Layout<BN__default, P> {
    blob: Layout<Buffer>;
    signed: boolean;
    constructor(span: number, signed: boolean, property?: P);
    /** @override */
    decode(b: Buffer, offset?: number): BN__default;
    /** @override */
    encode(src: BN__default, b: Buffer, offset?: number): number;
}
declare class WideBits<P extends string = ""> extends Layout<Record<string, boolean>, P> {
    _lower: any;
    _upper: any;
    constructor(property?: P);
    addBoolean(property: string): void;
    decode(b: Buffer, offset?: number): Record<string, boolean>;
    encode(src: any, b: Buffer, offset?: number): any;
}
declare function u8<P extends string = "">(property?: P): UInt<number, P>;
declare function u32<P extends string = "">(property?: P): UInt<number, P>;
declare function u64<P extends string = "">(property?: P): BNLayout<P>;
declare function u128<P extends string = "">(property?: P): BNLayout<P>;
declare function i64<P extends string = "">(property?: P): BNLayout<P>;
declare function i128<P extends string = "">(property?: P): BNLayout<P>;
declare class WrappedLayout<T, U, P extends string = ""> extends Layout<U, P> {
    layout: Layout<T>;
    decoder: (data: T) => U;
    encoder: (src: U) => T;
    constructor(layout: Layout<T>, decoder: (data: T) => U, encoder: (src: U) => T, property?: P);
    decode(b: Buffer, offset?: number): U;
    encode(src: U, b: Buffer, offset?: number): number;
    getSpan(b: Buffer, offset?: number): number;
}
declare function publicKey<P extends string = "">(property?: P): Layout<PublicKey, P>;
declare class OptionLayout<T, P> extends Layout<T | null, P> {
    layout: Layout<T>;
    discriminator: Layout<number>;
    constructor(layout: Layout<T>, property?: P);
    encode(src: T | null, b: Buffer, offset?: number): number;
    decode(b: Buffer, offset?: number): T | null;
    getSpan(b: Buffer, offset?: number): number;
}
declare function option<T, P extends string = "">(layout: Layout<T>, property?: P): Layout<T | null, P>;
declare function bool<P extends string = "">(property?: P): Layout<boolean, P>;
declare function decodeBool(value: number): boolean;
declare function encodeBool(value: boolean): number;
declare function vec<T, P extends string = "">(elementLayout: Layout<T>, property?: P): Layout<T[], P>;
declare function tagged<T, P extends string = "">(tag: BN__default, layout: Layout<T>, property?: P): Layout<T, P>;
declare function vecU8<P extends string = "">(property?: P): Layout<Buffer, P>;
declare function str<P extends string = "">(property?: P): Layout<string, P>;
interface EnumLayout<T, P extends string = ""> extends Layout<T, P> {
    registry: Record<string, Layout<any>>;
}
declare function rustEnum<T, P extends string = "">(variants: Layout<any>[], property?: P): EnumLayout<T, P>;
declare function array<T, P extends string = "">(elementLayout: Layout<T>, length: number, property?: P): Layout<T[], P>;
declare class Structure<T, P, D> extends Structure$1<T, P, D> {
    /** @override */
    decode(b: Buffer, offset?: number): D;
}
declare function struct<T, P extends string = "">(fields: T, property?: P, decodePrefixes?: boolean): T extends Layout<infer Value, infer Property>[] ? Structure<Value, P, {
    [K in Exclude<Extract<Property, string>, "">]: Extract<T[number], Layout<any, K>> extends Layout<infer V, any> ? V : any;
}> : any;
declare type GetLayoutSchemaFromStructure<T extends Structure<any, any, any>> = T extends Structure<any, any, infer S> ? S : any;
declare type GetStructureFromLayoutSchema<S> = Structure<any, any, S>;
declare class Union<Schema> extends Union$1<Schema> {
    encodeInstruction(instruction: any): Buffer;
    decodeInstruction(instruction: any): Partial<Schema>;
}
declare function union<UnionSchema extends {
    [key: string]: any;
} = any>(discr: any, defaultLayout?: any, property?: string): Union<UnionSchema>;
declare class Zeros extends Blob {
    decode(b: Buffer, offset: number): Buffer;
}
declare function zeros(length: number): Zeros;
declare function seq<T, P extends string = "", AnotherP extends string = "">(elementLayout: Layout<T, P>, count: number | BN__default | Layout<BN__default | number, P>, property?: AnotherP): Layout<T[], AnotherP>;

export { BNLayout, EnumLayout, GetLayoutSchemaFromStructure, GetStructureFromLayoutSchema, OptionLayout, Structure, Union, WideBits, WrappedLayout, array, bool, decodeBool, encodeBool, i128, i64, option, publicKey, rustEnum, seq, str, struct, tagged, u128, u32, u64, u8, union, vec, vecU8, zeros };
