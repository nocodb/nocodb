/** Mirrors skills.sh's own `Cache-Control`; never longer than upstream says. */
export const TTL_SECONDS = {
  leaderboard: 60,
  search: 60,
  curated: 300,
  detail: 300,
  audit: 300,
} as const;

/** How long a value stays servable past its TTL, when upstream fails. */
export const STALE_SECONDS = 24 * 60 * 60;

export const CACHE_MAX_ENTRIES = 5_000;

export const UPSTREAM_URL =
  process.env.SKILLS_UPSTREAM_URL ?? 'https://skills.sh';

export const UPSTREAM_TIMEOUT_MS = 15_000;

/** `/internal/*` only — the catalog routes are not limited. */
export const INTERNAL_RATE_LIMIT_MAX = 30;
export const INTERNAL_RATE_LIMIT_WINDOW = '1 minute';

export const PORT = Number(process.env.PORT ?? 3000);

/** Vercel sets this; local `vercel dev` binds loopback only. */
export const HOST = process.env.VERCEL ? '0.0.0.0' : '127.0.0.1';

/** Read per request: Vercel rotates the token during a function's life. */
export function oidcToken(): string | undefined {
  return process.env.VERCEL_OIDC_TOKEN || undefined;
}

/** Either unset disables `/internal/*` entirely, rather than leaving it open. */
export const INTERNAL_USERNAME = process.env.SKILLS_PROXY_INTERNAL_USER ?? '';
export const INTERNAL_PASSWORD =
  process.env.SKILLS_PROXY_INTERNAL_PASSWORD ?? '';
