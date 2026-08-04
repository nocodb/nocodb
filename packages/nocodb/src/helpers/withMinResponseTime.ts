/**
 * Floor (ms) for connection-test responses that read SSL cert files.
 *
 * The SSL file-path read is a timing oracle: a missing path fails fast, an
 * existing one proceeds to a slower connect attempt. Padding both to a common
 * floor removes that sub-floor differential. The value should exceed the
 * driver's connect-timeout so the "exists → connect → fail" path also lands
 * under the floor; otherwise an attacker pairing an unreachable host with
 * file-path probing can still observe the connect-timeout tail. On Cloud the
 * env-gated guard removes the read entirely, so this is defense-in-depth for
 * the self-host-allowed path only.
 */
export const SSL_FILE_PATH_TEST_MIN_RESPONSE_MS = 1500;

/**
 * Run `fn` and ensure the call occupies at least `minMs` of wall-clock time,
 * whether it resolves or rejects — used to flatten timing side-channels.
 */
export async function withMinResponseTime<T>(
  minMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const startNs = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    const remainingMs = minMs - elapsedMs;
    if (remainingMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingMs));
    }
  }
}
