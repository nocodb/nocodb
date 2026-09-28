/**
 * Resolve the Express `trust proxy` setting from `NC_TRUST_PROXY`.
 *
 * Default is **disabled** (`false`): without a configured, authoritative proxy
 * boundary, trusting `X-Forwarded-*` headers lets any client spoof the source
 * IP used in audit logs and IP-based controls (CWE-346). Operators with a known
 * proxy topology opt in via `NC_TRUST_PROXY`:
 *   - `true`  → trust the immediate upstream (all proxies)
 *   - `false` / unset → trust nothing (use the socket address)
 *   - a number → number of trusted proxy hops
 *   - anything else → passed through to Express (e.g. `loopback`,
 *     `10.0.0.0/8`, or a comma-separated subnet/keyword list)
 */
export function getTrustProxyConfig(): boolean | number | string {
  const raw = process.env.NC_TRUST_PROXY;

  if (raw === undefined || raw.trim() === '') return false;

  const value = raw.trim();
  const lower = value.toLowerCase();

  if (lower === 'true') return true;
  if (lower === 'false') return false;

  // Integer hop count (e.g. NC_TRUST_PROXY=1)
  if (/^\d+$/.test(value)) return Number(value);

  // Subnet / keyword list — Express compiles it via proxy-addr.
  return value;
}
