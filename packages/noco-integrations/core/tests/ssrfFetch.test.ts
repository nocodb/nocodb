import { createServer } from 'http';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SsrfBlockedHostError } from '../src/utils/externalDbSsrf';
import { ssrfSafeFetch } from '../src/utils/ssrfFetch';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

describe('ssrfSafeFetch', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/hop') {
        res.writeHead(302, { location: `http://127.0.0.1:${port}/` });
        return res.end();
      }
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => server.close());

  afterEach(() => {
    delete process.env.NC_DISABLE_SSRF_PROTECTION;
  });

  const blocked = async (url: string) => {
    const error = await ssrfSafeFetch(url).then(
      () => null,
      (e: Error) => e,
    );
    // undici wraps connect-time failures in `cause`.
    expect(
      error instanceof SsrfBlockedHostError ||
        error?.cause instanceof SsrfBlockedHostError,
      String(error),
    ).toBe(true);
  };

  it('refuses IP literals in blocked ranges', async () => {
    await blocked(`http://127.0.0.1:${port}/`);
    await blocked('http://169.254.169.254/latest/meta-data');
    await blocked('http://[::1]/');
    await blocked('http://[::ffff:10.0.0.1]/');
  });

  it('refuses names that resolve to a blocked address', async () => {
    await blocked(`http://localhost:${port}/`);
  });

  it('allows them when self-hosted protection is off', async () => {
    process.env.NC_DISABLE_SSRF_PROTECTION = 'true';
    const res = await ssrfSafeFetch(`http://localhost:${port}/hop`);
    expect(await res.text()).toBe('ok');
  });
});
