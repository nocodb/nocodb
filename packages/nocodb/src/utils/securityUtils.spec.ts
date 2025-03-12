import dns from 'dns';
import axios from 'axios';
import {
  isSafeURL,
  resolveFinalIPs,
  validateAndResolveURL,
} from './securityUtils';

jest.mock('dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

jest.mock('axios');

describe('URL Validation Functions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('resolveFinalIPs - resolves hostname to IP addresses', async () => {
    (dns.promises.lookup as jest.Mock).mockResolvedValueOnce([
      { address: '8.8.8.8' },
      { address: '8.8.4.4' },
    ]);

    const result = await resolveFinalIPs('example.com');
    expect(result).toEqual(['8.8.8.8', '8.8.4.4']);
  });

  test('resolveFinalIPs - returns hostname if already an IP', async () => {
    const result = await resolveFinalIPs('8.8.8.8');
    expect(result).toEqual(['8.8.8.8']);
  });

  test('isSafeURL - detects private IP addresses', async () => {
    (dns.promises.lookup as jest.Mock).mockResolvedValueOnce([
      { address: '192.168.1.1' },
    ]);
    const result = await isSafeURL('http://private.com');
    expect(result).toBe(false);
  });

  test('isSafeURL - allows public IPs', async () => {
    (dns.promises.lookup as jest.Mock).mockResolvedValueOnce([
      { address: '8.8.8.8' },
    ]);
    const result = await isSafeURL('http://google.com');
    expect(result).toBe(true);
  });

  test('validateAndResolveURL - follows redirects safely', async () => {
    (axios.head as jest.Mock).mockResolvedValueOnce({
      headers: { location: 'http://safe.com' },
    });
    (dns.promises.lookup as jest.Mock).mockResolvedValueOnce([
      { address: '8.8.8.8' },
    ]);

    const result = await validateAndResolveURL('http://redirect.com');
    expect(result).toBe('http://safe.com');
  });

  test('validateAndResolveURL - blocks redirects to private IPs', async () => {
    (axios.head as jest.Mock).mockResolvedValueOnce({
      headers: { location: 'http://unsafe.com' },
    });
    (dns.promises.lookup as jest.Mock).mockResolvedValueOnce([
      { address: '192.168.1.1' },
    ]);

    expect(validateAndResolveURL('http://redirect.com')).rejects.toThrow();
  });
});
