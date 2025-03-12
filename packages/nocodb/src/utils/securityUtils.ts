import dns from 'dns';
import net from 'net';
import axios from 'axios';
import { NcError } from '~/helpers/catchError';

// Check if a string is a valid IP address (IPv4 or IPv6)
function isIPAddress(hostname: string): boolean {
  return net.isIP(hostname) !== 0; // Returns 4 (IPv4), 6 (IPv6), or 0 (invalid)
}

// Function to check if an IP address is private
function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./, // 10.0.0.0 - 10.255.255.255
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0 - 172.31.255.255
    /^192\.168\./, // 192.168.0.0 - 192.168.255.255
    /^127\./, // 127.0.0.0 - 127.255.255.255 (Loopback)
    /^0\./, // 0.0.0.0 (Invalid address space)
    /^169\.254\./, // 169.254.0.0 - 169.254.255.255 (Link-local)
    /^::1$/, // IPv6 Loopback
    /^fc00:/, // IPv6 Private
    /^fd00:/, // IPv6 Private
  ];
  return privateRanges.some((range) => range.test(ip));
}

// Function to resolve a hostname to its final IP addresses
export async function resolveFinalIPs(hostname: string): Promise<string[]> {
  if (isIPAddress(hostname)) return [hostname];

  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    return addresses.map((entry) => entry.address);
  } catch (error) {
    NcError.dnsLookupFailed(hostname, error.message);
  }
}

// Function to check if a URL resolves to a safe IP
export async function isSafeURL(url: string): Promise<boolean> {
  const parsedURL = new URL(url);
  const ipAddresses = await resolveFinalIPs(parsedURL.hostname);

  // Check if any resolved IP is private
  return ipAddresses.every((ip) => !isPrivateIP(ip));
}

// Function to perform a HEAD request to detect URL redirects and validate new domains
async function performHeadRequest(
  url: string,
  maxRedirects: number = 3,
): Promise<string> {
  let currentURL = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    try {
      const response = await axios.head(currentURL, { maxRedirects: 0 });

      if (response?.headers?.location) {
        const newURL = new URL(response.headers.location, currentURL)
          .toString()
          // remove unnecessary slash at the end of the URL
          .replace(/\/$/, '');

        currentURL = newURL;
        redirectCount++;
      } else {
        return currentURL;
      }
    } catch (error) {
      return currentURL; // Return the last resolved URL if HEAD request fails
    }
  }

  NcError.tooManyRedirects(url);
}

// Function to validate a URL and ensure it does not redirect to a restricted IP
export async function validateAndResolveURL(url: string): Promise<string> {
  const finalURL = await performHeadRequest(url);
  if (!(await isSafeURL(finalURL))) {
    NcError.forbiddenIpRedirectBlocked(url);
  }
  return finalURL;
}
