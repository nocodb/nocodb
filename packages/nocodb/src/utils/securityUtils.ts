import dns from 'dns';
import { isIPv4 } from 'net';
import axios from 'axios';

function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./, // 10.0.0.0 - 10.255.255.255
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0 - 172.31.255.255
    /^192\.168\./, // 192.168.0.0 - 192.168.255.255
    /^127\./, // 127.0.0.0 - 127.255.255.255 (localhost)
    /^0\.0\.0\.0/, // 0.0.0.0
    /^169\.254\./, // 169.254.0.0 - 169.254.255.255 (link-local)
  ];
  return privateRanges.some((range) => range.test(ip));
}

async function isSafeURL(url: string): Promise<boolean> {
  try {
    const parsedURL = new URL(url);
    const ipAddresses = await dns.promises.lookup(parsedURL.hostname);
    return isIPv4(ipAddresses.address) && !isPrivateIP(ipAddresses.address); // Block private/internal IPs
  } catch (error) {
    return false; // Reject invalid URLs
  }
}

async function performHeadRequest(url: string): Promise<string> {
  try {
    const response = await axios.head(url, { maxRedirects: 0 });
    return response.headers.location || url;
  } catch (error) {
    return url; // Return the original URL if HEAD request fails
  }
}

export async function validateAndResolveURL(url: string): Promise<string> {
  const finalURL = await performHeadRequest(url);
  if (!(await isSafeURL(finalURL))) {
    throw new Error('Redirect to forbidden IP blocked');
  }
  return finalURL;
}
