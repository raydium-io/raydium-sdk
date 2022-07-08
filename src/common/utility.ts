export async function sleep(ms: number): Promise<void> {
  new Promise((resolve) => setTimeout(resolve, ms));
}

export function getTimestamp(): number {
  return new Date().getTime();
}
