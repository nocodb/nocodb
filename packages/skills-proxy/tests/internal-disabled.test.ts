import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';

// Its own file: the credentials are read once at module scope, and node gives
// each test file a process.
delete process.env.SKILLS_PROXY_INTERNAL_USER;
delete process.env.SKILLS_PROXY_INTERNAL_PASSWORD;

const { registerRoutes } = await import('../src/routes.js');

function build() {
  const app = Fastify({ logger: false });
  registerRoutes(app);
  return app;
}

describe('internal routes, unconfigured', () => {
  it('does not register the routes at all, so there is nothing to attack', async () => {
    const app = build();

    for (const url of ['/internal/status', '/internal/cache']) {
      const res = await app.inject({ method: 'GET', url });

      // 404, not 401 — an unset deployment must not advertise these exist.
      assert.equal(res.statusCode, 404);
    }
  });

  it('refuses a flush rather than defaulting to open', async () => {
    const app = build();
    const res = await app.inject({ method: 'DELETE', url: '/internal/cache' });

    assert.equal(res.statusCode, 404);
  });

  it('still serves the public routes', async () => {
    const app = build();
    const res = await app.inject({ method: 'GET', url: '/healthz' });

    assert.equal(res.statusCode, 200);
  });
});
