import type { NextFunction, Request, Response } from 'express';
import { ncSiteUrl } from '~/utils/envs';

/**
 * Normalises a path to `/` or `/seg/.../` (leading and trailing slash).
 * Returns `/` for anything that is not a plain path.
 */
export function normalizeBasePath(input?: string | null): string {
  if (!input) return '/';
  const trimmed = input.trim();
  if (!trimmed.startsWith('/') || /^\/[/\\]/.test(trimmed)) return '/';
  if (/[?#"'<>\s]/.test(trimmed)) return '/';
  const segments = trimmed.split('/').filter(Boolean);
  return segments.length ? `/${segments.join('/')}/` : '/';
}

/**
 * The subpath the app is served under, e.g. `/nocodb/` for
 * `NC_SITE_URL=https://host/nocodb`. Taken from the site URL only, so it
 * always agrees with links, sockets and emails built from that URL.
 */
export function resolveBasePath(
  siteUrl: string | undefined = ncSiteUrl,
): string {
  if (!siteUrl) return '/';
  try {
    return normalizeBasePath(new URL(siteUrl).pathname);
  } catch {
    return '/';
  }
}

let cachedBasePath: string | undefined;

export function getBasePath(): string {
  if (cachedBasePath === undefined) cachedBasePath = resolveBasePath();
  return cachedBasePath;
}

/**
 * Redirect target for an app path. At the root it stays root-relative; under a
 * subpath it is absolute from the site URL, which works whether or not the
 * proxy rewrites `Location` (nginx `proxy_redirect` only touches `/...`).
 */
export function toAppUrl(
  path: string,
  basePath = getBasePath(),
  siteUrl: string | undefined = ncSiteUrl,
): string {
  // Collapse leading slashes: `//host/x` would be a protocol-relative redirect.
  const safe = path.replace(/^[/\\]+/, '/');
  if (basePath === '/' || !siteUrl) return safe;
  const p = safe.startsWith('/') ? safe : `/${safe}`;
  return `${siteUrl.replace(/\/+$/, '')}${p}`;
}

/**
 * Points the generated SPA shell at `basePath`: root-absolute asset URLs,
 * the import map, and the Nuxt runtime config (router base, asset base and
 * API base). No-op for `/`. URLs that are already absolute (CDN) are left alone.
 */
export function rewriteIndexHtmlForBasePath(
  html: string,
  basePath: string,
): string {
  if (basePath === '/') return html;

  const prefix = basePath.slice(0, -1); // `/nocodb`

  // Function replacers: `$` in the path must not act as a replacement pattern.
  return (
    html
      // href="/x" / src="/x", but not protocol-relative "//x"
      .replace(
        /(\s(?:href|src)=)(["'])\/(?![/\\])/g,
        (_m, attr, quote) => `${attr}${quote}${prefix}/`,
      )
      // import map: {"imports":{"#entry":"/_nuxt/x.js"}}
      .replace(
        /("#entry"\s*:\s*")\/(?![/\\])/g,
        (_m, key) => `${key}${prefix}/`,
      )
      // window.__NUXT__.config = { app: { baseURL:"/", cdnURL:"/" }, public: { ncBackendUrl:"" } }
      .replace(/(\bbaseURL\s*:\s*)"\/"/g, (_m, key) => `${key}"${basePath}"`)
      .replace(/(\bcdnURL\s*:\s*)"\/?"/g, (_m, key) => `${key}"${basePath}"`)
      .replace(/(\bncBackendUrl\s*:\s*)""/g, (_m, key) => `${key}"${basePath}"`)
  );
}

/**
 * Lets the app answer under both `/x` and `/nocodb/x`, so it works whether or
 * not the reverse proxy strips the prefix. Websockets still need a stripping
 * proxy: socket.io handles them before express sees the request.
 * `originalUrl` is rewritten too: Nest matches route exclusions against it.
 */
export function stripBasePathMiddleware(
  basePath = getBasePath(),
  skip?: (req: Request) => boolean,
) {
  const prefix = basePath.slice(0, -1);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (prefix && !skip?.(req)) {
      const url = req.url;
      if (
        url === prefix ||
        url.startsWith(`${prefix}/`) ||
        url.startsWith(`${prefix}?`)
      ) {
        const rest = url.slice(prefix.length);
        req.url = rest.startsWith('/') ? rest : `/${rest}`;
        req.originalUrl = req.url;
      }
    }
    next();
  };
}
