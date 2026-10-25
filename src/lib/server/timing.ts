import "server-only";

// Where a request's time goes, one line per step, when HORIZON_TIMING=1:
// "[timing] session 180ms". Off otherwise, and free: the wrapper returns the
// promise untouched. Read the lines in order to see what waited on what.

const on = process.env.HORIZON_TIMING === "1";

export async function timed<T>(label: string, work: () => Promise<T>): Promise<T> {
  if (!on) return work();
  const t0 = performance.now();
  try {
    return await work();
  } finally {
    console.log(`[timing] ${label} ${Math.round(performance.now() - t0)}ms`);
  }
}
