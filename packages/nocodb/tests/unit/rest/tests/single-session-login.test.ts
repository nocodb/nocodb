import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import init from '../../init';
import { defaultUserArgs } from '../../factory/user';

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
}

export default function () {
  describe('Single-session login enforcement', singleSessionLoginTests);
}
