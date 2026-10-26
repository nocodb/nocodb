import { randomBytes, timingSafeEqual } from 'crypto';
import { SsoFailureCode } from 'nocodb-sdk';
import type { CookieOptions, Request } from 'express';
import type { StrategyOptionsWithRequest } from 'passport-google-oauth20';

export const GOOGLE_OAUTH_STATE_COOKIE = 'nc_google_oauth_state';

const STATE_TTL_MS = 10 * 60 * 1000;

type StateStore = NonNullable<StrategyOptionsWithRequest['store']>;
type StateStoreStoreCallback = (err: Error | null, state: string) => void;
type StateStoreVerifyCallback = (
  err: Error | null,
  ok: boolean,
  info?: { message: string; code: SsoFailureCode },
) => void;

function stateCookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!req.ncSiteUrl?.startsWith('https'),
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
    const state = randomBytes(24).toString('hex');
    req.res?.cookie(GOOGLE_OAUTH_STATE_COOKIE, state, {
      ...stateCookieOptions(req),
      maxAge: STATE_TTL_MS,
    });
    done(null, state);
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
    const expected = req.cookies?.[GOOGLE_OAUTH_STATE_COOKIE];
    // Single use: a consumed state must not be replayable.
    req.res?.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, stateCookieOptions(req));

    if (!isSameState(expected, providedState)) {
      return done(null, false, {
        message: 'Unable to verify authorization request state.',
        code: SsoFailureCode.SSO_STATE_INVALID,
      });
    }

    done(null, true, undefined);
  },
};
