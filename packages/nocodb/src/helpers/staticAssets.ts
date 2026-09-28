import compression from 'compression';
import type { ServeStaticOptions } from 'serve-static';
import type { RequestHandler } from 'express';

// serve-static defaults to `maxAge: 0`, which told browsers to revalidate every
// content-hashed chunk on every load — 683 conditional requests and ~1.3 min on a
// warm cache (nocodb/nocodb#14623).
const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache, must-revalidate';
const SHORT = 'public, max-age=3600';

/**
 * Freezing hashed assets is only safe because the SPA shell is never frozen: the
 * shell is the map to the hashed names, so a reload always lands on the new build.
 * Nuxt's two upgrade paths for an already-open tab — the `builds/latest.json` poll
 * and the `app:chunkError` reload — both end in that reload, so both depend on it.
 */
export function ncStaticCacheControl(filePath: string): string {
  const p = filePath.replace(/\\/g, '/');

  // The shell, and the self-destroying service worker that unregisters stale ones.
  if (p.endsWith('.html') || p.endsWith('/sw.js')) return REVALIDATE;

  if (p.includes('/_nuxt/builds/')) {
    // How an open tab learns a new build landed. Freezing it strands the tab.
    // meta/<uuid>.json is per-build, so it freezes like any hashed asset.
    return p.endsWith('/latest.json') ? REVALIDATE : IMMUTABLE;
  }

  // Everything else under _nuxt/ carries a content hash in its filename.
  if (p.includes('/_nuxt/')) return IMMUTABLE;

  // Unhashed and reused across builds: plugins/, js/, favicons, webmanifest.
  return SHORT;
}

export const ncStaticOptions: ServeStaticOptions = {
  setHeaders(res, filePath) {
    res.setHeader('Cache-Control', ncStaticCacheControl(filePath));
  },
};

// Files the dist actually serves. `compression()` wraps `res` and then calls
// next(), so on a miss the wrapped response carries on into Nest — mounting it
// alone would compress API traffic too. The filter keeps it inert there.
const STATIC_REQUEST =
  /^\/(?:$|index\.html$|_nuxt\/|js\/|css\/|plugins\/|[^/]+\.(?:js|css|json|svg|png|jpe?g|webp|ico|woff2?|ttf|map|webmanifest)$)/;

// Exported for the boundary test — a nested path never matches, because the
// extension arm cannot cross a `/`.
export function isStaticAssetRequest(reqPath: string): boolean {
  return STATIC_REQUEST.test(reqPath);
}

/**
 * Static assets only. Two reasons, both load-bearing:
 * - EE streams SSE (agent channels, the AI proxy bridge) and `compression`
 *   buffers until an explicit flush, so compressing those stalls the stream.
 * - Compressing API responses invites BREACH: they carry secrets (JWTs, tokens)
 *   alongside attacker-influenced record content. Dist files carry neither.
 */
export function ncStaticCompression(): RequestHandler {
  return compression({
    filter: (req, res) =>
      isStaticAssetRequest(req.path) && compression.filter(req, res),
  });
}
