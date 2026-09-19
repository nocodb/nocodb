import Fastify from 'fastify';
import { HOST, PORT } from './config.js';
import { registerRoutes } from './routes.js';

/**
 * NocoDB's skills.sh discovery proxy: holds the Vercel OIDC token a NocoDB pod
 * cannot mint, caches hard in front of it, re-serves the catalog.
 *
 * The catalog routes are unauthenticated and NOT rate limited — callers arrive
 * through our own proxy on one forwarded address, so a per-IP limit throttled
 * NocoDB's own traffic. Vercel handles bots; the cache protects the budget.
 */

export const app = Fastify({
  logger: true,
  trustProxy: true,
});

registerRoutes(app);

// Vercel's Fastify support detects the listen call and wraps the app as a
// Function; the port it passes is the one that matters in production.
app.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
