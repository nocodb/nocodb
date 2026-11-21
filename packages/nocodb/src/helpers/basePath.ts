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
 * `NC_SITE_URL=https://host/nocodb`. `NC_BASE_PATH` overrides it
 * (`NC_BASE_PATH=/` opts out).
 */
export function resolveBasePath(
  env: NodeJS.ProcessEnv = process.env,
  siteUrl: string | undefined = ncSiteUrl,
): string {
  if (env.NC_BASE_PATH !== undefined && env.NC_BASE_PATH !== '') {
    return normalizeBasePath(env.NC_BASE_PATH);
  }
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

  return (
    html
      // href="/x" / src="/x", but not protocol-relative "//x"
      .replace(/(\s(?:href|src)=)(["'])\/(?![/\\])/g, `$1$2${prefix}/`)
      // import map: {"imports":{"#entry":"/_nuxt/x.js"}}
      .replace(/("#entry"\s*:\s*")\/(?![/\\])/g, `$1${prefix}/`)
      // window.__NUXT__.config = { app: { baseURL:"/", cdnURL:"/" }, public: { ncBackendUrl:"" } }
      .replace(/(\bbaseURL\s*:\s*)"\/"/g, `$1"${basePath}"`)
      .replace(/(\bcdnURL\s*:\s*)"\/?"/g, `$1"${basePath}"`)
      .replace(/(\bncBackendUrl\s*:\s*)""/g, `$1"${basePath}"`)
  );
}

/**
 * Lets the app answer under both `/x` and `/nocodb/x`, so it works whether or
 * not the reverse proxy strips the prefix. Websockets still need a stripping
 * proxy: socket.io handles them before express sees the request.
 */
export function stripBasePathMiddleware(basePath = getBasePath()) {
  const prefix = basePath.slice(0, -1);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (prefix) {
      const url = req.url;
      if (
        url === prefix ||
        url.startsWith(`${prefix}/`) ||
        url.startsWith(`${prefix}?`)
      ) {
        const rest = url.slice(prefix.length);
        req.url = rest.startsWith('/') ? rest : `/${rest}`;
      }
    }
    next();
  };
}
