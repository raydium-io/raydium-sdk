interface LayoutConstructor {
    new <T, P>(): Layout<T, P>;
    new <T, P>(span?: T, property?: P): Layout<T, P>;
    readonly prototype: Layout;
}
interface Layout<T = any, P = ""> {
    span: number;
    property?: P;
    decode(b: Buffer, offset?: number): T;
    encode(src: T, b: Buffer, offset?: number): number;
    getSpan(b: Buffer, offset?: number): number;
    replicate<AP extends string>(name: AP): Layout<T, AP>;
}
declare const Layout: LayoutConstructor;
interface StructureConstructor {
    new <T = any, P = "", DecodeSchema extends {
        [key: string]: any;
    } = any>(): Structure<T, P, DecodeSchema>;
    new <T = any, P = "", DecodeSchema extends {
        [key: string]: any;
    } = any>(fields: T, property?: P, decodePrefixes?: boolean): Structure<T, P, DecodeSchema>;
}
interface Structure<T = any, P = "", DecodeSchema extends {
    [key: string]: any;
} = any> extends Layout<DecodeSchema, P> {
    span: number;
    decode(b: Buffer, offset?: number): DecodeSchema;
    layoutFor<AP extends string>(property: AP): Layout<DecodeSchema[AP]>;
    offsetOf<AP extends string>(property: AP): number;
}
declare const Structure: StructureConstructor;
interface UnionConstructor {
    new <UnionSchema extends {
        [key: string]: any;
    } = any>(): Union<UnionSchema>;
    new <UnionSchema extends {
        [key: string]: any;
    } = any>(discr: Layout<any, any>, defaultLayout: Layout<any, any>, property?: string): Union<UnionSchema>;
}
interface Union<UnionSchema extends {
    [key: string]: any;
} = any> extends Layout {
    registry: object;
    decode(b: Buffer, offset?: number): Partial<UnionSchema>;
    addVariant(variant: number, layout: Structure<any, any, Partial<UnionSchema>> | Layout<any, keyof UnionSchema>, property?: string): any;
}
declare const Union: UnionConstructor;
interface BitStructureConstructor {
    new (...params: any[]): BitStructure;
}
declare type BitStructure<T = unknown, P = ""> = Layout<T, P>;
declare const BitStructure: BitStructureConstructor;
interface UIntConstructor {
    new <T, P>(span?: T, property?: P): UInt<T, P>;
}
declare type UInt<T = any, P = ""> = Layout<T, P>;
declare const UInt: UIntConstructor;
interface BlobConstructor {
    new (...params: ConstructorParameters<LayoutConstructor>): Blob;
}
declare type Blob<P extends string = ""> = Layout<Buffer, P>;
declare const Blob: BlobConstructor;
declare const greedy: <P extends string = "">(elementSpan?: number, property?: P | undefined) => Layout<number, P>;
declare const u8: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const u16: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const u24: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const u32: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const u40: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const u48: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const nu64: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const u16be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const u24be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const u32be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const u40be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const u48be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const nu64be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s8: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s16: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s24: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s32: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s40: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s48: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const ns64: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s16be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s24be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s32be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s40be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const s48be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const ns64be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const f32: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const f32be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const f64: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const f64be: <P extends string = "">(property?: P | undefined) => Layout<number, P>;
declare const struct: <T, P extends string = "">(fields: T, property?: P | undefined, decodePrefixes?: boolean) => T extends Layout<infer Value, infer Property>[] ? Structure<Value, P, { [K in Exclude<Extract<Property, string>, "">]: Extract<T[number], Layout<any, K>> extends Layout<infer V, any> ? V : any; }> : any;
declare const seq: <T, P>(elementLayout: Layout<T, string>, count: number | Layout<number, string>, property?: P | undefined) => Layout<T[], "">;
declare const union: <UnionSchema extends {
    [key: string]: any;
} = any>(discr: Layout<any, any>, defaultLayout?: any, property?: string) => Union<UnionSchema>;
declare const unionLayoutDiscriminator: <P extends string = "">(layout: Layout<any, P>, property?: P | undefined) => any;
declare const blob: <P extends string = "">(length: number | Layout<number, P>, property?: P | undefined) => Blob<P>;
declare const cstr: <P extends string = "">(property?: P | undefined) => Layout<string, P>;
declare const utf8: <P extends string = "">(maxSpan: number, property?: P | undefined) => Layout<string, P>;
declare const bits: <T, P extends string = "">(word: Layout<T, "">, msb?: boolean, property?: P | undefined) => BitStructure<T, P>;
declare const offset: <T, P extends string = "">(layout: Layout<T, P>, offset?: number, property?: P | undefined) => Layout<T, P>;
declare type GetStructureSchema<T extends Structure> = T extends Structure<any, any, infer S> ? S : unknown;

export { BitStructure, Blob, GetStructureSchema, Layout, LayoutConstructor, Structure, UInt, Union, bits, blob, cstr, f32, f32be, f64, f64be, greedy, ns64, ns64be, nu64, nu64be, offset, s16, s16be, s24, s24be, s32, s32be, s40, s40be, s48, s48be, s8, seq, struct, u16, u16be, u24, u24be, u32, u32be, u40, u40be, u48, u48be, u8, union, unionLayoutDiscriminator, utf8 };
