import dns from 'dns';
import axios from 'axios';
import {
  isSafeURL,
  resolveFinalIPs,
  validateAndResolveURL,
} from './securityUtils';
import {afterEach} from "node:test";

// Mock dns.promises.lookup
jest.mock('dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    head: jest.fn(),
    interceptors: {
      response: {
        use: jest.fn((onFulfilled, onRejected) => ({
          onFulfilled,
          onRejected,
        })),
      },
    },
  };

  return {
    create: jest.fn(() => mockAxiosInstance),
    isAxiosError: jest.fn((error) => !!error.isAxiosError),
  };
});

// Mock NcError to prevent actual exceptions
jest.mock('~/helpers/catchError', () => ({
  NcError: {
    dnsLookupFailed: jest.fn((host, msg) => {
      throw new Error(`DNS lookup failed for ${host}: ${msg}`);
    }),
    forbiddenIpRedirectBlocked: jest.fn((url) => {
      throw new Error(`Forbidden IP redirect blocked: ${url}`);
    }),
    tooManyRedirects: jest.fn((url) => {
      throw new Error(`Too many redirects: ${url}`);
    }),
  },
}));

describe('URL Validation Functions', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance = {
      head: jest.fn(),
      interceptors: { response: { use: jest.fn() } },
    };
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
  });

  afterEach(()=>{
    jest.clearAllMocks();
  })

  test('resolveFinalIPs - resolves hostname to IP addresses', async () => {
    (dns.promises.lookup as jest.Mock).mockResolvedValue([
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
    mockAxiosInstance.head.mockResolvedValueOnce({
      headers: { location: 'http://safe.com' },
    });

    (dns.promises.lookup as jest.Mock)
      .mockResolvedValue([{ address: '8.8.8.8' }]);

    const result = await validateAndResolveURL('http://redirect.com');
    expect(result).toBe('http://safe.com');
  });

  test('validateAndResolveURL - blocks redirects to private IPs', async () => {
    mockAxiosInstance.head.mockResolvedValueOnce({
      headers: { location: 'http://unsafe.com' },
    });

    (dns.promises.lookup as jest.Mock).mockResolvedValue([
      { address: '192.168.1.1' },
    ]);

    await expect(validateAndResolveURL('http://redirect.com')).rejects.toThrow(
      'Forbidden IP redirect blocked: http://redirect.com',
    );
  });

  test('validateAndResolveURL - blocks non-responsive private IPs', async () => {
    (dns.promises.lookup as jest.Mock)
      .mockResolvedValue([
      { address: '192.168.1.1' },
    ]);

    mockAxiosInstance.head.mockRejectedValueOnce(new Error('Timeout'));

    await expect(validateAndResolveURL('http://private.com')).rejects.toThrow(
      'Forbidden IP redirect blocked: http://private.com',
    );
  });

  test('validateAndResolveURL - handles too many redirects', async () => {
    mockAxiosInstance.head.mockResolvedValue({
      headers: { location: 'http://redirect1.com' },
    });

    (dns.promises.lookup as jest.Mock).mockResolvedValue([
      { address: '8.8.8.8' },
    ]);

    await expect(validateAndResolveURL('http://loop.com')).rejects.toThrow(
      'Forbidden IP redirect blocked: http://loop.com',
    );
  });
});
