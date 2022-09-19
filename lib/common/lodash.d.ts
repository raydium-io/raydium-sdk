/**
 * https://youmightnotneed.com/lodash/
 */
declare function chunkArray<T>(arr: T[], chunkSize?: number, cache?: T[][]): T[][];
declare function intersection<T>(arr: T[], ...args: T[][]): T[];
declare function xor<T>(arr: T[], ...args: T[][]): T[];
declare function uniq<T>(arr: T[]): T[];

export { chunkArray, intersection, uniq, xor };
