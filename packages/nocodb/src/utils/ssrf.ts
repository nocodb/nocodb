import dnsCb from 'dns';
import dns from 'dns/promises';
import net, { isIP, type LookupFunction } from 'net';
import ipaddr from 'ipaddr.js';
import { OperationSource } from 'nocodb-sdk';
import {
  globalHttpAgent,
  globalHttpsAgent,
  RequestFilteringHttpAgent,
  RequestFilteringHttpsAgent,
} from 'request-filtering-agent';
import type { Duplex } from 'stream';
import { isCloud } from '~/utils/constants';
import {
  isBlockedIp,
  NAT64_LOCAL_USE,
  normaliseEmbeddedIpv4,
} from '~/helpers/dbSsrfLookup';

export type FilteredAgents = {
  httpAgent?: RequestFilteringHttpAgent | RequestFilteringHttpsAgent;
  httpsAgent?: RequestFilteringHttpAgent | RequestFilteringHttpsAgent;
};

export const INTERNAL_DB_HOST_BLOCKED =
  'Connection to internal hosts is not allowed';

// Self-hosted can opt out, so name the env var; cloud cannot.
export function internalDbHostBlockedMessage(): string {
  if (isCloud) return INTERNAL_DB_HOST_BLOCKED;
  return `${INTERNAL_DB_HOST_BLOCKED}. To connect to a database on a private network, set NC_ALLOW_LOCAL_EXTERNAL_DBS=true on the NocoDB server.`;
}

export const INTERNAL_ATTACHMENT_URL_BLOCKED =
  'URL not allowed: private/link-local address';

// Only signed-in users are told the server can be opened up.
export function internalAttachmentUrlBlockedMessage(
  source: OperationSource = OperationSource.ATTACHMENTS,
): string {
  if (isCloud || source !== OperationSource.ATTACHMENTS)
    return INTERNAL_ATTACHMENT_URL_BLOCKED;
  return `${INTERNAL_ATTACHMENT_URL_BLOCKED}. To allow attachment URLs on a private network, set NC_ALLOW_LOCAL_ATTACHMENTS=true on the NocoDB server.`;
}

// The anonymous guest and shared-base principals carry no id.
export function attachmentUrlSource(req?: {
  user?: { id?: string };
}): OperationSource {
  return req?.user?.id
    ? OperationSource.ATTACHMENTS
    : OperationSource.PUBLIC_ATTACHMENTS;
}

/**
 * Single source of truth for whether SSRF protection is active for a given
 * outbound source. Cloud always enforces; self-hosted honors env-var bypasses.
 */
export function isSsrfProtectionEnabled({
  source,
}: {
  source?: OperationSource;
} = {}): boolean {
  // Cloud always enforces SSRF protection — env bypasses are ignored
  if (isCloud) return true;

  // Global override — disables all SSRF protection for self-hosted
  if (process.env.NC_DISABLE_SSRF_PROTECTION === 'true') return false;

  // Granular overrides per source
  if (
    source === OperationSource.HOOKS &&
    (process.env.NC_ALLOW_LOCAL_HOOKS === 'true' ||
      process.env.NC_WEBHOOK_ALLOW_PRIVATE_NETWORK === 'true')
  )
    return false;

  if (
    source === OperationSource.EXTERNAL_DBS &&
    process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS === 'true'
  )
    return false;

  if (
    source === OperationSource.DATA_IMPORT &&
    process.env.NC_ALLOW_LOCAL_DATA_IMPORT === 'true'
  )
    return false;

  if (
    source === OperationSource.VAULTS &&
    process.env.NC_ALLOW_LOCAL_VAULTS === 'true'
  )
    return false;

  return true;
}

/**
 * NC_ALLOW_LOCAL_ATTACHMENTS relaxes protection rather than turning it off:
 * private ranges and loopback open, link-local (cloud metadata) stays blocked.
 * `true` covers signed-in users; `all` also anonymous ones (public forms,
 * shared bases).
 */
function allowsLocalAttachments(source?: OperationSource): boolean {
  if (isCloud) return false;
  const mode = process.env.NC_ALLOW_LOCAL_ATTACHMENTS;
  if (source === OperationSource.ATTACHMENTS)
    return mode === 'true' || mode === 'all';
  return source === OperationSource.PUBLIC_ATTACHMENTS && mode === 'all';
}

// Metadata endpoints outside link-local ranges. Only the exact address:
// 100.64.0.0/10 also carries Tailscale and other private overlays.
const METADATA_IPS = new Set(
  [
    'fd00:ec2::254', // AWS, IPv6
    '100.100.100.200', // Alibaba Cloud
  ].map((ip) => ipaddr.parse(ip).toNormalizedString()),
);

// Unwraps IPv4 carried in IPv6 (mapped, NAT64, 6to4, IPv4-compatible) first,
// as isBlockedIp does.
export function isLinkLocalOrMetadataIp(addr: string): boolean {
  if (!ipaddr.isValid(addr)) return isIP(addr) !== 0;
  const raw = ipaddr.parse(addr);
  // local-use NAT64 can't be unwrapped reliably; isBlockedIp blocks it too
  if (raw.kind() === 'ipv6' && (raw as ipaddr.IPv6).match(NAT64_LOCAL_USE))
    return true;
  const parsed = normaliseEmbeddedIpv4(raw);
  return (
    parsed.range() === 'linkLocal' ||
    METADATA_IPS.has(parsed.toNormalizedString())
  );
}

function linkLocalBlockedError(): NodeJS.ErrnoException {
  return Object.assign(
    new Error('Connection to link-local or metadata addresses is not allowed'),
    { code: 'EACCES' },
  );
}

// The agent's own lookup check runs on what this returns.
const linkLocalFilteringLookup: LookupFunction = (hostname, options, cb) => {
  dnsCb.lookup(hostname, options, (err, address, family) => {
    if (err) return cb(err, address, family);
    const addresses = Array.isArray(address) ? address : [{ address }];
    if (addresses.some((a) => isLinkLocalOrMetadataIp(a.address)))
      return cb(linkLocalBlockedError(), '', 0);
    cb(null, address, family);
  });
};

type ConnectionCallback = (err: Error | null, socket: Duplex) => void;

function blockLinkLocal(
  options: net.TcpNetConnectOpts,
  connect: (options: net.TcpNetConnectOpts) => Duplex,
): Duplex {
  if (options.host && isLinkLocalOrMetadataIp(options.host)) {
    const socket = new net.Socket();
    process.nextTick(() => socket.destroy(linkLocalBlockedError()));
    return socket;
  }
  return connect({ ...options, lookup: linkLocalFilteringLookup });
}

const PRIVATE_NETWORK_OPTIONS = { allowPrivateIPAddress: true };

class LocalAttachmentHttpAgent extends RequestFilteringHttpAgent {
  createConnection(options: net.TcpNetConnectOpts, cb?: ConnectionCallback) {
    return blockLinkLocal(options, (o) => super.createConnection(o, cb));
  }
}

class LocalAttachmentHttpsAgent extends RequestFilteringHttpsAgent {
  createConnection(options: net.TcpNetConnectOpts, cb?: ConnectionCallback) {
    return blockLinkLocal(options, (o) => super.createConnection(o, cb));
  }
}

let localAttachmentAgents: FilteredAgents;

// One agent per protocol: redirects can switch scheme (http → https).
function buildAgents(source?: OperationSource): FilteredAgents {
  if (allowsLocalAttachments(source)) {
    localAttachmentAgents ??= {
      httpAgent: new LocalAttachmentHttpAgent(PRIVATE_NETWORK_OPTIONS),
      httpsAgent: new LocalAttachmentHttpsAgent(PRIVATE_NETWORK_OPTIONS),
    };
    return localAttachmentAgents;
  }
  return { httpAgent: globalHttpAgent, httpsAgent: globalHttpsAgent };
}

/**
 * Create-time form of the outbound check: true when the url's host is, or
 * resolves to, a blocked internal address. The agent still enforces on send.
 * Unparseable urls are not judged here.
 */
export async function isInternalUrl(
  url: string,
  source?: OperationSource,
): Promise<boolean> {
  if (!isSsrfProtectionEnabled({ source })) return false;

  let host: string;
  try {
    // `hostname` keeps the brackets around an IPv6 literal
    host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return false;
  }

  if (!host) return false;
  const localAllowed = allowsLocalAttachments(source);
  const isBlocked = localAllowed ? isLinkLocalOrMetadataIp : isBlockedIp;
  if (isIP(host)) return isBlocked(host);
  if (host === 'localhost' || host.endsWith('.localhost')) return !localAllowed;

  try {
    const records = await dns.lookup(host, { all: true });
    return records.some((record) => isBlocked(record.address));
  } catch {
    return false;
  }
}

export function getFilteredAgents({
  source,
}: {
  url: string;
  source?: OperationSource;
}): FilteredAgents {
  if (!isSsrfProtectionEnabled({ source })) return {};
  return buildAgents(source);
}
