import dns from 'dns';
import { isIP } from 'net';
import { Agent } from 'undici';
import {
  isBlockedAddress,
  isSsrfProtectionEnabled,
  SsrfBlockedHostError,
} from './externalDbSsrf';
import type { LookupAddress, LookupOptions } from 'dns';

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/** Checks the addresses the socket will actually use, so DNS can't change between check and connect. */
function filteringLookup(
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback,
): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    if (addresses.some((a) => isBlockedAddress(a.address))) {
      return callback(new SsrfBlockedHostError(), []);
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

const filteringAgent = new Agent({ connect: { lookup: filteringLookup } });

/**
 * `fetch` for URLs a user supplied: refuses private, loopback, link-local and
 * metadata addresses, redirects included. Node skips the lookup for IP-literal
 * hosts, so those are checked here.
 */
export const ssrfSafeFetch: typeof fetch = async (input, init) => {
  if (!isSsrfProtectionEnabled()) return fetch(input, init);

  const url = new URL(input instanceof Request ? input.url : String(input));
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isBlockedAddress(host)) throw new SsrfBlockedHostError();

  const guarded: RequestInit & { dispatcher: Agent } = {
    ...init,
    dispatcher: filteringAgent,
  };
  return fetch(input, guarded);
};
