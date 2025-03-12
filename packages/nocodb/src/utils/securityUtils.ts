import dns from 'dns';
import net from 'net';
import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import { NcError } from '~/helpers/catchError';

// Determines if a string is a valid IP address (IPv4 or IPv6).
// Returns true if the string is an IP address, false otherwise.
function isIPAddress(hostname: string): boolean {
  return net.isIP(hostname) !== 0; // net.isIP returns 4 (IPv4), 6 (IPv6), or 0 (invalid)
}

// Checks if an IP address falls within private or restricted ranges.
// Returns true if the IP is private (e.g., 192.168.x.x), false if public.
function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./, // 10.0.0.0 - 10.255.255.255 (Private)
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0 - 172.31.255.255 (Private)
    /^192\.168\./, // 192.168.0.0 - 192.168.255.255 (Private)
    /^127\./, // 127.0.0.0 - 127.255.255.255 (Loopback)
    /^0\./, // 0.0.0.0 (Invalid address space)
    /^169\.254\./, // 169.254.0.0 - 169.254.255.255 (Link-local)
    /^::1$/, // IPv6 Loopback
    /^fc00:/, // IPv6 Private (Unique Local Address)
    /^fd00:/, // IPv6 Private (Unique Local Address)
  ];
  return privateRanges.some((range) => range.test(ip));
}

// Resolves a hostname to its IP addresses using DNS lookup.
// Returns an array of IP addresses or the input if it’s already an IP.
export async function resolveFinalIPs(hostname: string): Promise<string[]> {
  // If the hostname is already an IP, return it as a single-item array
  if (isIPAddress(hostname)) return [hostname];

  try {
    // Perform DNS lookup to get all associated IP addresses
    const addresses = await dns.promises.lookup(hostname, { all: true });
    return addresses.map((entry) => entry.address);
  } catch (error) {
    // Throw a custom error if DNS resolution fails
    NcError.dnsLookupFailed(hostname, error.message);
  }
}

// Verifies if a URL resolves to safe (non-private) IP addresses.
// Returns true if all resolved IPs are public, false otherwise.
export async function isSafeURL(url: string): Promise<boolean> {
  const parsedURL = new URL(url); // Parse the URL to extract the hostname
  const ipAddresses = await resolveFinalIPs(parsedURL.hostname); // Resolve hostname to IPs

  // Check that every resolved IP is not private
  return ipAddresses.every((ip) => !isPrivateIP(ip));
}

const axiosInstance = axios.create({ timeout: 30000 });

// Create an Axios instance with a global timeout to prevent hanging on non-responsive URLs
// const axiosInstance = axios.create({
//   timeout: 30000, // 30-second timeout for all requests
// });

// Add a response interceptor to handle errors, especially timeouts
axiosInstance.interceptors.response.use(
  (response) => response, // Pass successful responses through unchanged
  (error) => {
    // Log timeout errors for debugging purposes
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      console.log('Request timed out:', error.config.url);
    }
    return Promise.reject(error); // Propagate the error for further handling
  },
);

// Performs HEAD requests to follow redirects and determine the final URL.
// Returns the final resolved URL after following up to maxRedirects.
async function performHeadRequest(
  url: string,
  maxRedirects: number = 3,
): Promise<string> {
  let currentURL = url; // Start with the initial URL
  let redirectCount = 0; // Track the number of redirects

  // Continue until max redirects are reached or no further redirects occur
  while (redirectCount < maxRedirects) {
    try {
      // Send a HEAD request to check for redirects without fetching the body
      const response = await axiosInstance.head(currentURL, {
        maxRedirects: 0, // Disable automatic redirect following
        httpAgent: useAgent(currentURL, {
          stopPortScanningByUrlRedirection: true, // Prevent port scanning via redirects
        }),
        httpsAgent: useAgent(currentURL, {
          stopPortScanningByUrlRedirection: true, // Ensure security for HTTPS
        }),
      });

      // If a redirect location is provided in the response headers
      if (response?.headers?.location) {
        // Construct the new URL, resolving relative paths and removing trailing slashes
        const newURL = new URL(response.headers.location, currentURL)
          .toString()
          .replace(/\/$/, '');
        currentURL = newURL; // Update the current URL
        redirectCount++; // Increment the redirect counter
      } else {
        return currentURL; // No redirect, return the current URL
      }
    } catch (error) {
      // Handle manual redirects (e.g., 301) if Axios doesn’t follow them
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 301 &&
        error.response?.headers?.location
      ) {
        const newURL = error.response.headers.location;
        currentURL = new URL(newURL, currentURL).toString().replace(/\/$/, '');
        redirectCount++;
      } else {
        return currentURL; // Return the last valid URL if an error occurs
      }
    }
  }

  // If max redirects are exceeded, throw an error
  NcError.tooManyRedirects(url);
}

// Validates a URL by resolving redirects and checking for restricted IPs.
// Returns the final validated URL or throws an error if validation fails.
export async function validateAndResolveURL(url: string): Promise<string> {
  const parsedURL = new URL(url); // Parse the input URL
  const ipAddresses = await resolveFinalIPs(parsedURL.hostname); // Resolve hostname to IPs

  if (ipAddresses.some(isPrivateIP)) {
    throw NcError.forbiddenIpRedirectBlocked(url);
  }

  // Resolve redirects to get the final URL
  const finalURL = await performHeadRequest(url);

  // Verify that the final URL doesn’t resolve to a private IP
  if (!(await isSafeURL(finalURL))) {
    NcError.forbiddenIpRedirectBlocked(url);
  }

  return finalURL; // Return the validated, resolved URL
}
