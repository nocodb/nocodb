import { createHash, timingSafeEqual } from 'node:crypto';
import rateLimit from '@fastify/rate-limit';
import {
  INTERNAL_PASSWORD,
  INTERNAL_RATE_LIMIT_MAX,
  INTERNAL_RATE_LIMIT_WINDOW,
  INTERNAL_USERNAME,
  TTL_SECONDS,
  UPSTREAM_URL,
  oidcToken,
} from './config.js';
import { cacheEntries, cacheSize, dropCache } from './cache.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Operator endpoints: look at the cache, and throw it away.
 *
 * A flush only clears the instance that answered it — the cache is per-instance
 * (see `cache.ts`) and this service cannot reach its siblings. Call until
 * `dropped` is 0, or redeploy.
 */

export const isInternalEnabled = (): boolean =>
  !!INTERNAL_USERNAME && !!INTERNAL_PASSWORD;

/**
 * Digests, not raw strings: `timingSafeEqual` throws on a length mismatch,
 * which would leak the password's length.
 */
function matches(supplied: string, expected: string): boolean {
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();

  return timingSafeEqual(a, b);
}

function unauthorized(reply: FastifyReply): never {
  reply.header('www-authenticate', 'Basic realm="skills-proxy internal"');
  reply.code(401);

  throw { error: 'unauthorized', message: 'Valid credentials are required' };
}

async function requireBasicAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization ?? '';

  const [scheme, encoded] = header.split(' ');

  if (scheme?.toLowerCase() !== 'basic' || !encoded) unauthorized(reply);

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');

  // First colon only — a password may contain one, a username may not (RFC 7617).
  const separator = decoded.indexOf(':');

  if (separator < 0) unauthorized(reply);

  const user = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  // Both compared even when the username is wrong, so a valid one is no faster.
  const userOk = matches(user, INTERNAL_USERNAME);
  const passwordOk = matches(password, INTERNAL_PASSWORD);

  if (!userOk || !passwordOk) {
    request.log.warn(
      { ip: request.ip, url: request.url },
      'rejected internal request',
    );
    unauthorized(reply);
  }
}

interface PrefixQuery {
  prefix?: string;
}

export function registerInternalRoutes(app: FastifyInstance) {
  // Registering nothing makes an unconfigured deployment 404 rather than 401.
  if (!isInternalEnabled()) {
    app.log.warn(
      'SKILLS_PROXY_INTERNAL_USER / _PASSWORD unset — /internal/* is disabled',
    );
    return;
  }

  app.register(
    async (internal) => {
      // Scoped here, so the catalog routes stay unlimited (see `index.ts`).
      await internal.register(rateLimit, {
        max: INTERNAL_RATE_LIMIT_MAX,
        timeWindow: INTERNAL_RATE_LIMIT_WINDOW,
        keyGenerator: () => 'internal',
      });

      internal.addHook('preHandler', requireBasicAuth);

      internal.addHook('onSend', async (_request, reply, payload) => {
        reply.header('cache-control', 'no-store');
        return payload;
      });

      internal.get('/status', async () => ({
        ok: true,
        upstream: UPSTREAM_URL,
        // Whether one exists, never the value.
        oidcConfigured: !!oidcToken(),
        cache: { entries: cacheSize(), ttlSeconds: TTL_SECONDS },
        uptimeSeconds: Math.round(process.uptime()),
        // Which instance answered, so a no-op flush is distinguishable from one
        // that hit a sibling.
        instance: process.env.VERCEL_DEPLOYMENT_ID ?? process.pid,
      }));

      internal.get<{ Querystring: PrefixQuery }>('/cache', async (request) => {
        const entries = cacheEntries(request.query.prefix);

        return { count: entries.length, total: cacheSize(), entries };
      });

      /** `prefix` is a cache-key prefix: `detail:`, `audit:`, `search:`… */
      internal.delete<{ Querystring: PrefixQuery }>(
        '/cache',
        async (request) => {
          const { prefix } = request.query;
          const dropped = dropCache(prefix);

          request.log.info({ prefix, dropped }, 'cache dropped');

          return { dropped, remaining: cacheSize() };
        },
      );
    },
    { prefix: '/internal' },
  );
}
