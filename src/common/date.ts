export type TimeStamp = string | number | Date;

export const isNumber = (val): boolean => typeof val === "number";
export type DateParam = string | number | Date | undefined;

export const getDate = (value?: DateParam): Date => (value ? new Date(value) : new Date());
export const getTime = (value?: DateParam): number => getDate(value).getTime();

/** A must be milliseconds */
export function isDateBefore(timestampA: TimeStamp, timestampB: TimeStamp, options?: { unit?: "ms" | "s" }): boolean {
  const realTimestampB = isNumber(timestampB)
    ? (timestampB as number) * (options?.unit === "s" ? 1000 : 1)
    : timestampB;
  return new Date(timestampA).getTime() <= realTimestampB;
}

/** A must be milliseconds */
export function isDateAfter(timestampA: TimeStamp, timestampB: TimeStamp, options?: { unit?: "ms" | "s" }): boolean {
  const realTimestampB = isNumber(timestampB)
    ? (timestampB as number) * (options?.unit === "s" ? 1000 : 1)
    : timestampB;
  return new Date(timestampA).getTime() > realTimestampB;
}

export function offsetDateTime(
  baseDate: DateParam,
  offset: {
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
  },
): Date {
  const timestamp = getTime(baseDate);
  const offsetedTimestamp =
    timestamp +
    (offset.days ? offset.days * 24 * 60 * 60 * 1000 : 0) +
    (offset.hours ? offset.hours * 60 * 60 * 1000 : 0) +
    (offset.minutes ? offset.minutes * 60 * 1000 : 0) +
    (offset.seconds ? offset.seconds * 1000 : 0) +
    (offset.milliseconds ? offset.milliseconds : 0);
  return getDate(offsetedTimestamp);
}
