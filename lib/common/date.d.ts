declare type TimeStamp = string | number | Date;
declare const isNumber: (val: any) => boolean;
declare type DateParam = string | number | Date | undefined;
declare const getDate: (value?: DateParam) => Date;
declare const getTime: (value?: DateParam) => number;
/** A must be milliseconds */
declare function isDateBefore(timestampA: TimeStamp, timestampB: TimeStamp, options?: {
    unit?: "ms" | "s";
}): boolean;
/** A must be milliseconds */
declare function isDateAfter(timestampA: TimeStamp, timestampB: TimeStamp, options?: {
    unit?: "ms" | "s";
}): boolean;
declare function offsetDateTime(baseDate: DateParam, offset: {
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
}): Date;

export { DateParam, TimeStamp, getDate, getTime, isDateAfter, isDateBefore, isNumber, offsetDateTime };
