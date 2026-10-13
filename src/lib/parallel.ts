/**
 * Runs `work` over every item, up to `limit` at a time, results in the same
 * order. For loading many banks: one at a time costs a database round trip
 * (~200 ms) per bank; all at once can flood the database. A few at a time is
 * both fast and polite.
 */
export async function mapWithLimit<T, R>(items: readonly T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return results;
}
