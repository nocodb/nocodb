import dns from 'dns/promises';
import { isIP } from 'net';
import ipaddr from 'ipaddr.js';
import { OperationSource } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { isSsrfProtectionEnabled } from '~/utils/ssrf';

/**
 * Reject database hosts that resolve to non-routable ranges (private,
 * loopback, link-local incl. cloud-metadata 169.254.0.0/16, unique-local,
 * reserved). Handles IPv4-mapped IPv6 (`::ffff:a.b.c.d`) and unbracketed
 * IPv6 literals like `::1`.
 *
 * Set `NC_ALLOW_LOCAL_EXTERNAL_DBS=true` (or `NC_DISABLE_SSRF_PROTECTION=true`)
 * to trust the operator and bypass the check — used by deployments that
 * intentionally connect to localhost or private-network databases.
 */
export async function validateDbConnectionHost(host: unknown): Promise<void> {
  if (!isSsrfProtectionEnabled({ source: OperationSource.EXTERNAL_DBS }))
    return;
  if (typeof host !== 'string' || host.length === 0) return;

  const trimmed = host.trim();
  if (
    trimmed === '0.0.0.0' ||
    trimmed === '::' ||
    /^localhost$/i.test(trimmed)
  ) {
    NcError.badRequest('Connection to internal hosts is not allowed');
  }

  // TOCTOU note: the driver re-resolves at connect-time; a controlled DNS
  // record with short TTL could flip between this lookup and the driver's
  // connect(). Mitigating fully requires passing the resolved IP to the
  // driver, which is per-driver wiring out of scope here.
  let resolvedIps: string[] = [];
  if (isIP(trimmed)) {
    resolvedIps = [trimmed];
  } else {
    try {
      const records = await dns.lookup(trimmed, { all: true });
      resolvedIps = records.map((r) => r.address);
    } catch {
      // Let the driver surface DNS failures.
      return;
    }
  }

  for (const addr of resolvedIps) {
    if (!ipaddr.isValid(addr)) continue;
    let parsed = ipaddr.parse(addr);
    // Normalise IPv4-mapped IPv6 (::ffff:192.168.1.1 -> 192.168.1.1).
    if (
      parsed.kind() === 'ipv6' &&
      (parsed as ipaddr.IPv6).isIPv4MappedAddress()
    ) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    const range = parsed.range();
    // ipaddr.js range values:
    // ipv4: "unicast" | "private" | "loopback" | "linkLocal" | "multicast"
    //       | "reserved" | "broadcast" | "unspecified" | "carrierGradeNat"
    // ipv6: "unicast" | "loopback" | "linkLocal" | "uniqueLocal" |
    //       "ipv4Mapped" | "rfc6145" | "rfc6052" | "6to4" | "teredo" |
    //       "reserved" | "unspecified" | "benchmarking" | "amt"
    const blocked = new Set([
      'private',
      'loopback',
      'linkLocal',
      'uniqueLocal',
      'reserved',
      'unspecified',
      'broadcast',
      'carrierGradeNat',
    ]);
    if (blocked.has(range)) {
      NcError.badRequest('Connection to internal hosts is not allowed');
    }
  }
}
