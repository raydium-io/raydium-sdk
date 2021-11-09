// https://youmightnotneed.com/lodash/
export function chunkArray<T>(arr: T[], chunkSize = 1, cache: T[][] = []): T[][] {
  const tmp = [...arr];
  if (chunkSize <= 0) return cache;
  while (tmp.length) cache.push(tmp.splice(0, chunkSize));
  return cache;
}
