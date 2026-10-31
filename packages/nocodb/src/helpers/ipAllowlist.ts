import ipaddr from 'ipaddr.js';
import { normalizeIpAllowlist } from 'nocodb-sdk';
import type { IPv4, IPv6 } from 'ipaddr.js';
import type { NcRequest } from 'nocodb-sdk';

/**
 * Helpers for the API-token IP allowlist feature.
 *
 * Entries may be single IPv4/IPv6 addresses or CIDR ranges. Matching is done
 * against the trust-proxy-aware `req.clientIp`. IPv4-mapped IPv6 addresses
 * (e.g. `::ffff:192.168.1.5`) are normalized to IPv4 so a plain IPv4 rule
 * still matches a client that arrives over a dual-stack socket.
 */

type Address = IPv4 | IPv6;

/**
 * Raised by the authtoken strategy when a token's allowlist rejects the
 * caller. GlobalGuard surfaces it as a 401 instead of falling through to
 * OAuth / guest, which would only report an invalid token.
 */
export class ApiTokenIpRestrictedError {
  readonly msg =
    'Token is restricted to specific IP addresses; this request originates from a disallowed IP';
}

interface IpRange {
  addr: Address;
  prefix: number;
}

// Dotted-quad IPv4 only: ipaddr.isValid also takes `127.1`, hex and octal
// (`010.0.0.1` is 8.0.0.1), which would match a different address than shown.
function parseAddress(value: string): Address | null {
  if (ipaddr.IPv4.isValidFourPartDecimal(value)) {
    return ipaddr.IPv4.parse(value);
  }
  // Zone ids (fe80::1%eth0) never appear on a client address.
  if (!value.includes('%') && ipaddr.IPv6.isValid(value)) {
    return ipaddr.IPv6.parse(value);
  }
  return null;
}

function parseEntry(entry: string): IpRange | null {
  const [addrPart, prefixPart, ...rest] = entry.split('/');
  if (rest.length) return null;

  const addr = parseAddress(addrPart);
  if (!addr) return null;

  const maxPrefix = addr.kind() === 'ipv4' ? 32 : 128;
  let prefix = maxPrefix;
  if (prefixPart !== undefined) {
    if (!/^\d{1,3}$/.test(prefixPart)) return null;
    prefix = Number(prefixPart);
    if (prefix > maxPrefix) return null;
  }

  // Clients are matched as IPv4, so a mapped range must be IPv4 too.
  if (addr.kind() === 'ipv6' && (addr as IPv6).isIPv4MappedAddress()) {
    if (prefix < 96) return null;
    return { addr: (addr as IPv6).toIPv4Address(), prefix: prefix - 96 };
  }

  return { addr, prefix };
}

// Canonical form: compressed lowercase IPv6, network address for ranges.
function formatEntry({ addr, prefix }: IpRange): string {
  const maxPrefix = addr.kind() === 'ipv4' ? 32 : 128;
  if (prefix === maxPrefix) return addr.toString();

  const cidr = `${addr.toString()}/${prefix}`;
  const network =
    addr.kind() === 'ipv4'
      ? ipaddr.IPv4.networkAddressFromCIDR(cidr)
      : ipaddr.IPv6.networkAddressFromCIDR(cidr);
  return `${network.toString()}/${prefix}`;
}

function parseClientIp(clientIp: string): Address | null {
  const addr = parseAddress(clientIp);
  if (addr?.kind() === 'ipv6' && (addr as IPv6).isIPv4MappedAddress()) {
    return (addr as IPv6).toIPv4Address();
  }
  return addr;
}

// Ranges a request arrives from when it comes through a proxy, a container
// network or the same host. CGNAT is left out: tailnets and carrier NAT hand
// out real client addresses there.
const INTERNAL_RANGES = new Set([
  'private',
  'loopback',
  'linkLocal',
  'uniqueLocal',
]);

/**
 * The caller IP as the allowlist sees it (IPv4-mapped IPv6 folded to IPv4),
 * and whether it is an internal address — behind a proxy without
 * NC_TRUST_PROXY that is the proxy's, not the client's.
 */
export function describeClientIp(
  clientIp: string | undefined | null,
): { ip: string; internal: boolean } | null {
  const addr = clientIp ? parseClientIp(clientIp) : null;
  if (!addr) return null;
  return { ip: addr.toString(), internal: INTERNAL_RANGES.has(addr.range()) };
}

/** True if a single allowlist entry is a valid IP address or CIDR range. */
export function isValidIpOrCidr(entry: string): boolean {
  return !!entry && !!parseEntry(entry);
}

/**
 * Validate a raw allowlist. Returns the entries in canonical form (deduped)
 * and the raw entries that failed IP/CIDR validation.
 */
export function validateIpAllowlist(input?: string | string[] | null): {
  entries: string[];
  invalid: string[];
} {
  const entries: string[] = [];
  const invalid: string[] = [];

  for (const raw of normalizeIpAllowlist(input)) {
    const range = parseEntry(raw);
    if (!range) {
      invalid.push(raw);
      continue;
    }
    const canonical = formatEntry(range);
    if (!entries.includes(canonical)) entries.push(canonical);
  }

  return { entries, invalid };
}

/**
 * Read a stored allowlist (JSON text, or an already-parsed array) into its
 * entries. Returns [] for an unrestricted token or a malformed value.
 */
export function parseIpAllowlist(value: unknown): string[] {
  if (!value) return [];

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.filter((e): e is string => typeof e === 'string' && !!e.trim())
      : [];
  } catch {
    return [];
  }
}

/** The stored column is JSON text; API responses carry it as an array. */
export function withParsedIpAllowlist<T extends { ip_allowlist?: unknown }>(
  tokens: T[],
): (T & { ip_allowlist: string[] })[] {
  return tokens.map((token) => ({
    ...token,
    ip_allowlist: parseIpAllowlist(token.ip_allowlist),
  }));
}

// `clientIp` is set by Noco's request middleware; `ip` covers apps built
// without it. Both follow NC_TRUST_PROXY.
export function getClientIp(req: NcRequest): string | undefined {
  return req.clientIp ?? req.ip;
}

/**
 * Check whether `clientIp` is permitted by `allowlist`.
 * An empty / missing allowlist means unrestricted → always allowed.
 * A malformed client IP against a non-empty allowlist is denied.
 */
export function isIpAllowed(
  clientIp: string | undefined | null,
  allowlist: string[] | undefined | null,
): boolean {
  if (!allowlist?.length) return true;

  const client = clientIp ? parseClientIp(clientIp) : null;
  if (!client) return false;

  return allowlist.some((entry) => {
    // Malformed stored entries are skipped; input is validated at write time.
    const range = parseEntry(entry);
    return (
      !!range &&
      range.addr.kind() === client.kind() &&
      client.match(range.addr, range.prefix)
    );
  });
}
