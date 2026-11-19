import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { SsoFailureCode } from 'nocodb-sdk';
import type { CookieOptions, Request } from 'express';
import type { StrategyOptionsWithRequest } from 'passport-google-oauth20';

export const GOOGLE_OAUTH_STATE_COOKIE = 'nc_google_oauth_state';

const STATE_TTL_MS = 10 * 60 * 1000;
// Attempt cookies kept per flow: two open sign-in tabs plus a retry. Abandoned
// ones would otherwise ride on every request until they expire.
const MAX_ATTEMPT_COOKIES = 3;

type StateStore = NonNullable<StrategyOptionsWithRequest['store']>;
type StateStoreStoreCallback = (err: Error | null, state: string) => void;
type StateStoreVerifyCallback = (
  err: Error | null,
  ok: boolean,
  info?: { message: string; code: SsoFailureCode },
) => void;

export const OIDC_STATE_COOKIE = 'nc_oidc_state';
export const SAML_STATE_COOKIE = 'nc_saml_state';
export const SAML_RESTART_COOKIE = 'nc_saml_restart';

interface BrowserStateOptions {
  // The callback arrives as a cross-site POST (SAML HTTP-POST binding), which
  // `SameSite=Lax` cookies do not ride on.
  crossSitePost?: boolean;
}

function stateCookieOptions(
  req: Request,
  { crossSitePost = false }: BrowserStateOptions = {},
): CookieOptions {
  const secure = !!req.ncSiteUrl?.startsWith('https');
  return {
    httpOnly: true,
    // `None` needs `Secure`; over http the attribute is left out and a callback
    // that arrives without the cookie is re-posted from our own origin.
    sameSite: crossSitePost ? (secure ? 'none' : undefined) : 'lax',
    secure,
    path: '/',
  };
}

function isSameState(expected: unknown, provided: unknown) {
  if (typeof expected !== 'string' || typeof provided !== 'string') {
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

// One cookie per attempt, so a second sign-in tab does not overwrite the first's state.
function attemptCookieName(cookieName: string, state: string) {
  return `${cookieName}_${createHash('sha256')
    .update(state)
    .digest('hex')
    .slice(0, 16)}`;
}

function isAttemptCookieName(cookieName: string, name: string) {
  return (
    name.length === cookieName.length + 17 &&
    name.startsWith(`${cookieName}_`) &&
    /^[0-9a-f]{16}$/.test(name.slice(cookieName.length + 1))
  );
}

/**
 * Binds a sign-in to the browser that starts it: `state` goes into an HttpOnly
 * cookie the callback has to present again. Returns `state`.
 */
export function issueBrowserState(
  req: Request,
  cookieName: string,
  state: string = randomBytes(24).toString('hex'),
  options?: BrowserStateOptions,
): string {
  // Relies on the Cookie header listing oldest first (an RFC 6265 SHOULD). If
  // it doesn't, a live older attempt may go instead and has to be retried; the
  // one issued here is never dropped and the cap holds either way.
  const attempts = Object.keys(req.cookies ?? {}).filter((name) =>
    isAttemptCookieName(cookieName, name),
  );
  for (const name of attempts.slice(
    0,
    Math.max(0, attempts.length - (MAX_ATTEMPT_COOKIES - 1)),
  )) {
    req.res?.clearCookie(name, stateCookieOptions(req, options));
  }

  req.res?.cookie(attemptCookieName(cookieName, state), state, {
    ...stateCookieOptions(req, options),
    maxAge: STATE_TTL_MS,
  });
  return state;
}

/**
 * Whether `provided` is the state issued to this browser. Clears the cookie
 * either way: a state is single use.
 */
export function consumeBrowserState(
  req: Request,
  cookieName: string,
  provided: unknown,
  options?: BrowserStateOptions,
): boolean {
  if (typeof provided !== 'string') return false;
  const name = attemptCookieName(cookieName, provided);
  const expected = req.cookies?.[name];
  req.res?.clearCookie(name, stateCookieOptions(req, options));
  return isSameState(expected, provided);
}

/** Whether this request carries the cookie `state` was issued under; leaves it set. */
export function hasBrowserState(
  req: Request,
  cookieName: string,
  provided: unknown,
): boolean {
  return (
    typeof provided === 'string' &&
    !!req.cookies?.[attemptCookieName(cookieName, provided)]
  );
}

/** Sets a short-lived HttpOnly flag cookie on this browser. */
export function setBrowserMarker(
  req: Request,
  cookieName: string,
  ttlMs: number,
  options?: BrowserStateOptions,
) {
  req.res?.cookie(cookieName, '1', {
    ...stateCookieOptions(req, options),
    maxAge: ttlMs,
  });
}

/** Whether this browser carries the flag cookie; clears it if so. */
export function takeBrowserMarker(
  req: Request,
  cookieName: string,
  options?: BrowserStateOptions,
): boolean {
  if (!req.cookies?.[cookieName]) return false;
  req.res?.clearCookie(cookieName, stateCookieOptions(req, options));
  return true;
}

/**
 * passport-oauth2 state store binding the Google authorization request to the
 * browser that started it: the state rides in an HttpOnly cookie and the
 * callback must present the same value.
 */
export const googleOAuthStateStore: StateStore = {
  // passport-oauth2 picks the overload by arity: (req, meta, callback) here.
  store(
    req: Request,
    metaOrCallback: unknown,
    callback?: StateStoreStoreCallback,
  ) {
    const done =
      callback ?? (metaOrCallback as StateStoreStoreCallback | undefined);
    done(null, issueBrowserState(req, GOOGLE_OAUTH_STATE_COOKIE));
  },

  // ...and (req, state, meta, callback) here.
  verify(
    req: Request,
    providedState: string,
    metaOrCallback: unknown,
    callback?: StateStoreVerifyCallback,
  ) {
    const done =
      callback ?? (metaOrCallback as StateStoreVerifyCallback | undefined);
    if (!consumeBrowserState(req, GOOGLE_OAUTH_STATE_COOKIE, providedState)) {
      return done(null, false, {
        message: 'Unable to verify authorization request state.',
        code: SsoFailureCode.SSO_STATE_INVALID,
      });
    }

    done(null, true, undefined);
  },
};
