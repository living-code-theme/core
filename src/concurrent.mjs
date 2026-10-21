// Ordered, bounded work. On failure, drain in-flight work and do not start more requests.
export async function concurrent(items, limit, run) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 16) throw new Error("Concurrency must be between 1 and 16");
  const results = new Array(items.length);
  let cursor = 0, failure;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!failure && cursor < items.length) {
      const index = cursor++;
      try { results[index] = await run(items[index], index); }
      catch (error) { failure ??= error; }
    }
  }));
  if (failure) throw failure;
  return results;
}
