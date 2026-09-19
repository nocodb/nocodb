import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import Fastify from 'fastify';

// Before the first import: the credentials are module-scope consts.
process.env.SKILLS_PROXY_INTERNAL_USER = 'ops';
// Colons on purpose — catches a naive `split(':')`.
process.env.SKILLS_PROXY_INTERNAL_PASSWORD = 'correct:horse:battery';

const { registerRoutes } = await import('../src/routes.js');
const { cached, clearCache, cacheSize } = await import('../src/cache.js');

function build() {
  const app = Fastify();
  registerRoutes(app);
  return app;
}

const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

const GOOD = basic('ops', 'correct:horse:battery');

describe('internal routes', () => {
  afterEach(clearCache);

  it('refuses a request with no credentials, and says how to send them', async () => {
    const app = build();
    const res = await app.inject({ method: 'GET', url: '/internal/status' });

    assert.equal(res.statusCode, 401);
    assert.match(res.headers['www-authenticate'] as string, /^Basic realm=/);
  });

  it('refuses a wrong password', async () => {
    const app = build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/status',
      headers: { authorization: basic('ops', 'wrong') },
    });

    assert.equal(res.statusCode, 401);
  });

  it('refuses a wrong username', async () => {
    const app = build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/status',
      headers: { authorization: basic('someone', 'correct:horse:battery') },
    });

    assert.equal(res.statusCode, 401);
  });

  it('refuses a non-basic scheme', async () => {
    const app = build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/status',
      headers: { authorization: 'Bearer correct:horse:battery' },
    });

    assert.equal(res.statusCode, 401);
  });

  it('refuses a header with no colon at all', async () => {
    const app = build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/status',
      headers: {
        authorization: `Basic ${Buffer.from('ops').toString('base64')}`,
      },
    });

    assert.equal(res.statusCode, 401);
  });

  it('keeps the whole password when it contains colons', async () => {
    const app = build();

    const res = await app.inject({
      method: 'GET',
      url: '/internal/status',
      headers: { authorization: GOOD },
    });

    assert.equal(res.statusCode, 200);

    // The reverse: truncating at the first colon must not pass either.
    const truncated = await app.inject({
      method: 'GET',
      url: '/internal/status',
      headers: { authorization: basic('ops', 'correct') },
    });

    assert.equal(truncated.statusCode, 401);
  });

  it('reports status without leaking the OIDC token', async () => {
    process.env.VERCEL_OIDC_TOKEN = 'super-secret-token';

    const app = build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/status',
      headers: { authorization: GOOD },
    });

    assert.equal(res.statusCode, 200);

    const body = res.json();
    assert.equal(body.ok, true);
    assert.equal(body.oidcConfigured, true);
    assert.doesNotMatch(res.body, /super-secret-token/);

    delete process.env.VERCEL_OIDC_TOKEN;
  });

  it('never lets a shared cache hold an operator view', async () => {
    const app = build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/status',
      headers: { authorization: GOOD },
    });

    assert.equal(res.headers['cache-control'], 'no-store');
  });

  it('lists cache keys without their values', async () => {
    await cached('detail:a/b', 60, async () => ({ huge: 'payload' }));

    const app = build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/cache',
      headers: { authorization: GOOD },
    });

    const body = res.json();
    assert.equal(body.count, 1);
    assert.equal(body.entries[0].key, 'detail:a/b');
    assert.equal(body.entries[0].fresh, true);
    assert.doesNotMatch(res.body, /payload/);
  });

  it('narrows the listing to a prefix', async () => {
    await cached('detail:a/b', 60, async () => 1);
    await cached('audit:a/b', 60, async () => 2);

    const app = build();
    const res = await app.inject({
      method: 'GET',
      url: '/internal/cache?prefix=audit:',
      headers: { authorization: GOOD },
    });

    const body = res.json();
    assert.equal(body.count, 1);
    assert.equal(body.total, 2);
    assert.equal(body.entries[0].key, 'audit:a/b');
  });

  it('drops everything and reports how much it dropped', async () => {
    await cached('detail:a/b', 60, async () => 1);
    await cached('audit:a/b', 60, async () => 2);

    const app = build();
    const res = await app.inject({
      method: 'DELETE',
      url: '/internal/cache',
      headers: { authorization: GOOD },
    });

    assert.deepEqual(res.json(), { dropped: 2, remaining: 0 });
    assert.equal(cacheSize(), 0);
  });

  it('drops only the matching prefix', async () => {
    await cached('detail:a/b', 60, async () => 1);
    await cached('detail:c/d', 60, async () => 2);
    await cached('audit:a/b', 60, async () => 3);

    const app = build();
    const res = await app.inject({
      method: 'DELETE',
      url: '/internal/cache?prefix=detail:',
      headers: { authorization: GOOD },
    });

    assert.deepEqual(res.json(), { dropped: 2, remaining: 1 });
  });

  it('leaves the public routes unauthenticated', async () => {
    const app = build();
    const res = await app.inject({ method: 'GET', url: '/healthz' });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().ok, true);
  });

  // Every NocoDB instance arrives through one proxy, so a per-IP limit on the
  // catalog routes counts them as one caller and throttles our own traffic.
  it('does not rate limit the public routes', async () => {
    const app = await build().ready();

    for (let i = 0; i < 60; i += 1) {
      const res = await app.inject({ method: 'GET', url: '/healthz' });
      assert.equal(res.statusCode, 200, `request ${i} was limited`);
    }
  });

  it('rate limits /internal, which bounds password guessing', async () => {
    const app = await build().ready();

    const codes = new Set<number>();

    // Past the ceiling with wrong passwords: must hit the limiter, not 401 forever.
    for (let i = 0; i < 40; i += 1) {
      const res = await app.inject({
        method: 'GET',
        url: '/internal/status',
        headers: { authorization: basic('ops', `guess-${i}`) },
      });
      codes.add(res.statusCode);
    }

    assert.ok(codes.has(429), `expected a 429, saw ${[...codes].join(', ')}`);
  });

  it('cannot be stepped around by rotating X-Forwarded-For', async () => {
    // Production config: behind a proxy, so `request.ip` is a client header.
    const app = Fastify({ trustProxy: true });
    registerRoutes(app);
    await app.ready();

    const codes = new Set<number>();

    for (let i = 0; i < 40; i += 1) {
      const res = await app.inject({
        method: 'GET',
        url: '/internal/status',
        headers: {
          authorization: basic('ops', `guess-${i}`),
          'x-forwarded-for': `10.0.0.${i}`,
        },
      });
      codes.add(res.statusCode);
    }

    assert.ok(codes.has(429), `expected a 429, saw ${[...codes].join(', ')}`);
  });
});
