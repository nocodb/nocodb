import { UPSTREAM_TIMEOUT_MS, UPSTREAM_URL, oidcToken } from './config.js';

/**
 * Every `/api/v1/*` endpoint 401s without a Vercel OIDC token, which only a
 * Vercel deployment can mint — the reason this service exists. `/api/download/*`
 * is public and NOT proxied; NocoDB fetches bundles directly.
 */

export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Seconds, from a 429's `Retry-After`. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

/** skills.sh's own error envelope, which we pass through unchanged. */
interface UpstreamErrorBody {
  error?: string;
  message?: string;
}

export async function fetchUpstream<T>(
  path: string,
  query: Record<string, string | undefined> = {},
  /** `/api/search` is public, unlike `/api/v1/*`. Proxied for the cache alone. */
  opts: { anonymous?: boolean } = {},
): Promise<T> {
  const url = new URL(path, UPSTREAM_URL);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

  const token = opts.anonymous ? undefined : oidcToken();

  if (!opts.anonymous && !token) {
    // Its own code, so the operator sees "no OIDC federation" rather than
    // "skills.sh rejected our credential".
    throw new UpstreamError(
      503,
      'oidc_unavailable',
      'No Vercel OIDC token is available. Enable OIDC Federation for this project.',
    );
  }

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        accept: 'application/json',
        'user-agent': 'nocodb-skills-proxy',
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    throw new UpstreamError(
      504,
      'upstream_unreachable',
      `Could not reach skills.sh: ${(e as Error).message}`,
    );
  }

  if (response.ok) return (await response.json()) as T;

  let body: UpstreamErrorBody = {};
  try {
    body = (await response.json()) as UpstreamErrorBody;
  } catch {
    // A non-JSON error body tells us nothing the status has not already.
  }

  const retryAfter = Number(response.headers.get('retry-after'));

  throw new UpstreamError(
    response.status,
    body.error ?? 'upstream_error',
    body.message ?? `skills.sh responded ${response.status}`,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  );
}
