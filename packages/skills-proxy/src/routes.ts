import { TTL_SECONDS } from './config.js';
import { cacheSize, cached } from './cache.js';
import { UpstreamError, fetchUpstream } from './upstream.js';
import { registerInternalRoutes } from './internal.js';
import type { FastifyInstance, FastifyReply } from 'fastify';

/**
 * Paths mirror upstream's, so a client swaps the base URL and nothing else:
 * point it at skills.sh directly and, given a token, it behaves identically.
 */

interface LeaderboardQuery {
  view?: string;
  page?: string;
  per_page?: string;
}

interface SearchQuery {
  q?: string;
  limit?: string;
  owner?: string;
}

/** Upstream accepts only these; anything else is a 400 we can answer ourselves. */
const VIEWS = new Set(['all-time', 'trending', 'hot']);

function send(reply: FastifyReply, ttl: number, stale: boolean, body: unknown) {
  reply.header(
    'cache-control',
    `public, max-age=${ttl}, stale-while-revalidate=${ttl * 10}`,
  );

  // Answered from cache after upstream refused; callers may surface it.
  if (stale) reply.header('x-skills-proxy-stale', '1');

  return body;
}

function fail(reply: FastifyReply, e: unknown): never {
  if (e instanceof UpstreamError) {
    if (e.retryAfter) reply.header('retry-after', String(e.retryAfter));

    // A 401 upstream is our credential problem, never the caller's.
    const status = e.status === 401 ? 502 : e.status;

    reply.code(status);
    throw { error: e.code, message: e.message };
  }

  reply.code(500);
  throw { error: 'internal_error', message: (e as Error).message };
}

export function registerRoutes(app: FastifyInstance) {
  app.get('/healthz', async () => ({ ok: true, cached: cacheSize() }));

  registerInternalRoutes(app);

  /** Public upstream, proxied for the cache alone. The one NocoDB calls. */
  app.get<{ Querystring: SearchQuery }>(
    '/api/search',
    async (request, reply) => {
      const { q, limit = '50', owner } = request.query;

      if (!q || q.trim().length < 2) {
        reply.code(400);
        throw {
          error: 'invalid_request',
          message: 'q is required and must be at least 2 characters',
        };
      }

      const needle = q.trim();
      const key = `public-search:${needle.toLowerCase()}:${limit}:${
        owner ?? ''
      }`;

      try {
        const { value, stale } = await cached(key, TTL_SECONDS.search, () =>
          fetchUpstream(
            '/api/search',
            { q: needle, limit, owner },
            { anonymous: true },
          ),
        );
        return send(reply, TTL_SECONDS.search, stale, value);
      } catch (e) {
        return fail(reply, e);
      }
    },
  );

  app.get<{ Querystring: LeaderboardQuery }>(
    '/api/v1/skills',
    async (request, reply) => {
      const { view = 'all-time', page = '0', per_page = '100' } = request.query;

      if (!VIEWS.has(view)) {
        reply.code(400);
        throw {
          error: 'invalid_request',
          message: `view must be one of ${[...VIEWS].join(', ')}`,
        };
      }

      const key = `leaderboard:${view}:${page}:${per_page}`;

      try {
        const { value, stale } = await cached(key, TTL_SECONDS.leaderboard, () =>
          fetchUpstream('/api/v1/skills', { view, page, per_page }),
        );
        return send(reply, TTL_SECONDS.leaderboard, stale, value);
      } catch (e) {
        return fail(reply, e);
      }
    },
  );

  app.get<{ Querystring: SearchQuery }>(
    '/api/v1/skills/search',
    async (request, reply) => {
      const { q, limit = '50', owner } = request.query;

      // Upstream's own minimum, enforced here so a mistyped box costs nothing.
      if (!q || q.trim().length < 2) {
        reply.code(400);
        throw {
          error: 'invalid_request',
          message: 'q is required and must be at least 2 characters',
        };
      }

      const needle = q.trim();
      const key = `search:${needle.toLowerCase()}:${limit}:${owner ?? ''}`;

      try {
        const { value, stale } = await cached(key, TTL_SECONDS.search, () =>
          fetchUpstream('/api/v1/skills/search', { q: needle, limit, owner }),
        );
        return send(reply, TTL_SECONDS.search, stale, value);
      } catch (e) {
        return fail(reply, e);
      }
    },
  );

  app.get('/api/v1/skills/curated', async (_request, reply) => {
    try {
      const { value, stale } = await cached('curated', TTL_SECONDS.curated, () =>
        fetchUpstream('/api/v1/skills/curated'),
      );
      return send(reply, TTL_SECONDS.curated, stale, value);
    } catch (e) {
      return fail(reply, e);
    }
  });

  // `{source}/{skill}`, where source is `owner/repo` or a bare host — so the
  // tail is a wildcard rather than a fixed segment count.
  app.get<{ Params: { '*': string } }>(
    '/api/v1/skills/audit/*',
    async (request, reply) => {
      const ref = normaliseRef(request.params['*'], reply);
      const key = `audit:${ref}`;

      try {
        const { value, stale } = await cached(key, TTL_SECONDS.audit, () =>
          fetchUpstream(`/api/v1/skills/audit/${ref}`),
        );
        return send(reply, TTL_SECONDS.audit, stale, value);
      } catch (e) {
        return fail(reply, e);
      }
    },
  );

  app.get<{ Params: { '*': string } }>(
    '/api/v1/skills/*',
    async (request, reply) => {
      const ref = normaliseRef(request.params['*'], reply);
      const key = `detail:${ref}`;

      try {
        const { value, stale } = await cached(key, TTL_SECONDS.detail, () =>
          fetchUpstream(`/api/v1/skills/${ref}`),
        );
        return send(reply, TTL_SECONDS.detail, stale, value);
      } catch (e) {
        return fail(reply, e);
      }
    },
  );
}

/**
 * A `{source}/{skill}` tail, safe to paste into an upstream URL. `.` and `..`
 * are refused rather than encoded — normalisation would let one walk out of
 * `/api/v1/skills/`.
 */
function normaliseRef(raw: string, reply: FastifyReply): string {
  const segments = (raw ?? '').split('/').filter(Boolean);

  const ok =
    segments.length >= 2 &&
    segments.length <= 4 &&
    segments.every((s) => s !== '.' && s !== '..' && /^[\w.@-]+$/.test(s));

  if (!ok) {
    reply.code(400);
    throw { error: 'invalid_request', message: `Invalid skill ref: ${raw}` };
  }

  return segments.join('/');
}
