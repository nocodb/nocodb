import dns from 'dns/promises';
import { isIP } from 'net';
import ipaddr from 'ipaddr.js';
import { NcError } from '~/helpers/catchError';

/**
 * Reject database hosts that resolve to non-routable ranges (private,
 * loopback, link-local incl. cloud-metadata 169.254.0.0/16, unique-local,
 * reserved). Handles IPv4-mapped IPv6 (`::ffff:a.b.c.d`) and unbracketed
 * IPv6 literals like `::1`.
 *
 * Set `NC_ALLOW_INTERNAL_DB_HOSTS=true` to bypass for deployments that
 * intentionally connect to localhost / private-network databases.
 */
export async function validateDbConnectionHost(host: unknown): Promise<void> {
  if (process.env.NC_ALLOW_INTERNAL_DB_HOSTS === 'true') return;
  if (typeof host !== 'string' || host.length === 0) return;

  const trimmed = host.trim();
  if (
    trimmed === '0.0.0.0' ||
    trimmed === '::' ||
    /^localhost$/i.test(trimmed)
  ) {
    NcError.badRequest('Connection to internal hosts is not allowed');
  }

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
