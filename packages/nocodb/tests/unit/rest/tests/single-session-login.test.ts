import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import init from '../../init';
import { defaultUserArgs } from '../../factory/user';
import Noco from '~/Noco';

// Single-session enforcement
//
// Each successful login rotates the user's token_version and clears any
// existing refresh tokens. As a result:
//   - Prior session JWTs become invalid (token_version mismatch in JWT strategy).
//   - Prior session refresh tokens are deleted from the DB.
//   - The new session's JWT + refresh token work normally.
//   - API tokens are NOT affected (the JWT strategy short-circuits before the
//     token_version check on is_api_token).
//
// Note on assertions: /auth/user/me uses GlobalGuard which silently falls
// back to a guest user when JWT validation fails (returns 200 with
// `roles.guest: true`). We check `response.body.email` instead of status
// code to distinguish "valid session" from "JWT rejected, treated as guest".

function singleSessionLoginTests() {
  let context: Awaited<ReturnType<typeof init>>;

  beforeEach(async function () {
    context = await init(false, 'editor', { skipSakila: true });
  });

  // Helper: sign in and return both the JWT and the refresh_token cookie value.
  async function signIn(): Promise<{ token: string; refreshToken: string }> {
    const res = await request(context.app)
      .post('/api/v1/auth/user/signin')
      .send({
        email: defaultUserArgs.email,
        password: defaultUserArgs.password,
      })
      .expect(200);

    const setCookie = res.headers['set-cookie'] as unknown as
      | string[]
      | string
      | undefined;
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
      ? [setCookie]
      : [];
    const refreshCookie = cookies.find((c) =>
      c.startsWith('refresh_token='),
    );
    expect(refreshCookie, 'signin should set a refresh_token cookie').to.be.a(
      'string',
    );
    const refreshToken = refreshCookie!
      .split(';')[0]
      .replace('refresh_token=', '');

    return { token: res.body.token, refreshToken };
  }

  // Helper: returns true if the JWT is accepted by GlobalGuard (real user).
  // Returns false if the JWT is rejected (guard falls back to guest).
  async function isJwtValid(token: string): Promise<boolean> {
    const res = await request(context.app)
      .get('/api/v1/auth/user/me')
      .set('xc-auth', token)
      .expect(200);
    return res.body?.email === defaultUserArgs.email && !res.body?.roles?.guest;
  }

  it('Second login invalidates prior session JWT', async () => {
    const sessionA = await signIn();
    expect(await isJwtValid(sessionA.token), 'session A valid initially').to.be
      .true;

    // Second login rotates token_version
    const sessionB = await signIn();

    expect(await isJwtValid(sessionA.token), 'session A invalidated').to.be
      .false;
    expect(await isJwtValid(sessionB.token), 'session B valid').to.be.true;
  });

  it('Second login invalidates prior refresh token', async () => {
    const sessionA = await signIn();
    const sessionB = await signIn();

    // Session A's refresh token was deleted by session B's login
    await request(context.app)
      .post('/api/v1/auth/token/refresh')
      .set('Cookie', `refresh_token=${sessionA.refreshToken}`)
      .expect(400);

    // Session B's refresh token still works
    await request(context.app)
      .post('/api/v1/auth/token/refresh')
      .set('Cookie', `refresh_token=${sessionB.refreshToken}`)
      .expect(200);
  });

  it('API tokens are not affected by concurrent login', async () => {
    // init() created context.xc_token (API token) for this user.
    // Verify it works before any signin.
    const before = await request(context.app)
      .get('/api/v1/auth/user/me')
      .set('xc-token', context.xc_token)
      .expect(200);
    expect(before.body.email).to.equal(defaultUserArgs.email);

    // Trigger a fresh login (rotates user.token_version).
    await signIn();

    // API token still works — JWT strategy short-circuits on is_api_token.
    const after = await request(context.app)
      .get('/api/v1/auth/user/me')
      .set('xc-token', context.xc_token)
      .expect(200);
    expect(after.body.email).to.equal(defaultUserArgs.email);
  });

  it('Same-session token refresh preserves the active session', async () => {
    const session = await signIn();

    // The refresh endpoint rotates the refresh token but does NOT rotate
    // token_version, so the original access token continues to validate.
    const refreshRes = await request(context.app)
      .post('/api/v1/auth/token/refresh')
      .set('Cookie', `refresh_token=${session.refreshToken}`)
      .expect(200);

    expect(refreshRes.body.token).to.be.a('string');
    expect(refreshRes.body.token).to.not.equal(session.token);

    // Both the freshly issued JWT and the original JWT are still valid.
    expect(await isJwtValid(refreshRes.body.token)).to.be.true;
    expect(await isJwtValid(session.token)).to.be.true;
  });

  it('Third login invalidates second login (chain of invalidations)', async () => {
    const sessionA = await signIn();
    const sessionB = await signIn();
    const sessionC = await signIn();

    expect(await isJwtValid(sessionA.token), 'A invalidated').to.be.false;
    expect(await isJwtValid(sessionB.token), 'B invalidated').to.be.false;
    expect(await isJwtValid(sessionC.token), 'C valid').to.be.true;

    // Only C's refresh token remains usable.
    await request(context.app)
      .post('/api/v1/auth/token/refresh')
      .set('Cookie', `refresh_token=${sessionA.refreshToken}`)
      .expect(400);
    await request(context.app)
      .post('/api/v1/auth/token/refresh')
      .set('Cookie', `refresh_token=${sessionB.refreshToken}`)
      .expect(400);
    await request(context.app)
      .post('/api/v1/auth/token/refresh')
      .set('Cookie', `refresh_token=${sessionC.refreshToken}`)
      .expect(200);
  });

  // SSO short-token exchange flow — EE only. Mocks the IdP redirect step by
  // minting the short-lived token directly (same shape and JWT secret as
  // `generateShortLivedToken` in ee/middlewares/sso-paasport). The exchange
  // endpoint (`/auth/long-lived-token`) is what actually establishes the
  // session, so single-session enforcement should kick in there.
  const ssoIt = process.env.EE === 'true' ? it : it.skip;

  ssoIt('SSO short-token exchange invalidates prior session', async () => {
    // Establish a prior local-password session for the same user.
    const localSession = await signIn();
    expect(await isJwtValid(localSession.token), 'local session valid').to.be
      .true;

    // Mint a short-lived SSO token directly (mirrors what the SSO passport
    // middleware does after the IdP authenticates the user).
    const config = Noco.getConfig();
    const shortToken = jwt.sign(
      {
        id: context.user.id,
        email: context.user.email,
        sso_client_type: 'saml',
        sso_client_id: 'mock-client-id',
      },
      config.auth.jwt.secret,
      { expiresIn: '1m' },
    );

    // Exchange the short token for a full session via /auth/long-lived-token.
    const exchangeRes = await request(context.app)
      .post('/auth/long-lived-token')
      .set('xc-short-token', shortToken)
      .expect(201);

    expect(exchangeRes.body.token, 'exchange returns a JWT').to.be.a('string');

    // The prior local session is invalidated by the SSO exchange.
    expect(
      await isJwtValid(localSession.token),
      'prior local session invalidated by SSO login',
    ).to.be.false;

    // The new SSO session is valid.
    expect(
      await isJwtValid(exchangeRes.body.token),
      'new SSO session valid',
    ).to.be.true;

    // Local session's refresh token is also gone.
    await request(context.app)
      .post('/api/v1/auth/token/refresh')
      .set('Cookie', `refresh_token=${localSession.refreshToken}`)
      .expect(400);
  });

  ssoIt('Second SSO exchange invalidates prior SSO session', async () => {
    const config = Noco.getConfig();
    const mintShortToken = () =>
      jwt.sign(
        {
          id: context.user.id,
          email: context.user.email,
          sso_client_type: 'saml',
          sso_client_id: 'mock-client-id',
        },
        config.auth.jwt.secret,
        { expiresIn: '1m' },
      );

    // First SSO exchange
    const firstRes = await request(context.app)
      .post('/auth/long-lived-token')
      .set('xc-short-token', mintShortToken())
      .expect(201);
    expect(await isJwtValid(firstRes.body.token), 'first SSO session valid').to
      .be.true;

    // Second SSO exchange — should invalidate the first
    const secondRes = await request(context.app)
      .post('/auth/long-lived-token')
      .set('xc-short-token', mintShortToken())
      .expect(201);

    expect(await isJwtValid(firstRes.body.token), 'first SSO invalidated').to.be
      .false;
    expect(await isJwtValid(secondRes.body.token), 'second SSO valid').to.be
      .true;
  });
}

export default function () {
  describe('Single-session login enforcement', singleSessionLoginTests);
}
