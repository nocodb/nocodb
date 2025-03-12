import dns from 'dns';
import axios from 'axios';

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

// Function to check if a URL resolves to a safe IP
async function isSafeURL(url: string): Promise<boolean> {
  try {
    const parsedURL = new URL(url);
    const ipAddresses = await dns.promises.resolve4(parsedURL.hostname);

    // Check if any resolved IP is private
    for (const ip of ipAddresses) {
      if (isPrivateIP(ip)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false; // Reject invalid URLs
  }
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

      if (response.headers.location) {
        const newURL = new URL(
          response.headers.location,
          currentURL,
        ).toString();
        if (!(await isSafeURL(newURL))) {
          throw new Error('Redirect to forbidden IP blocked');
        }
        currentURL = newURL;
        redirectCount++;
      } else {
        return currentURL;
      }
    } catch (error) {
      return currentURL; // Return the last resolved URL if HEAD request fails
    }
  }

  throw new Error('Too many redirects detected, possible redirect loop');
}

// Function to validate a URL and ensure it does not redirect to a restricted IP
export async function validateAndResolveURL(url: string): Promise<string> {
  const finalURL = await performHeadRequest(url);
  if (!(await isSafeURL(finalURL))) {
    throw new Error('Redirect to forbidden IP blocked');
  }
  return finalURL;
}
