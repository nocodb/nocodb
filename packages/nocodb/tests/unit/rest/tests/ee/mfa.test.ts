import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import { PlanFeatureTypes } from 'nocodb-sdk';
import init from '../../../init';
import { defaultUserArgs } from '../../../factory/user';
import { isEE } from '../../../utils/helpers';
import { overrideFeature } from '../../../utils/plan.utils';
import { Workspace } from '~/models';

function mfaTests() {
  let context;

  beforeEach(async function () {
    context = await init(false, 'editor', { skipSakila: true });
  });

  // Helper: generate a valid TOTP code from a secret
  async function generateTotpCode(secret: string): Promise<string> {
    const otplib = await import('otplib');
    return otplib.generateSync({ secret });
  }

  // Helper: setup 2FA and return setup data
  async function setup2FA() {
    const setupRes = await request(context.app)
      .post('/api/v2/auth/mfa/setup')
      .set('xc-auth', context.token)
      .send({ password: defaultUserArgs.password })
      .expect(200);

    return setupRes.body;
  }

  // Helper: complete MFA signin dance, returns a fresh auth token
  async function mfaSigninForToken(secret: string): Promise<string> {
    const signinRes = await request(context.app)
      .post('/api/v2/auth/user/signin')
      .send({
        email: defaultUserArgs.email,
        password: defaultUserArgs.password,
      })
      .expect(200);

    const code = await generateTotpCode(secret);

    const verifyRes = await request(context.app)
      .post('/api/v2/auth/mfa/verify')
      .send({ token: signinRes.body.twoFactorToken, code })
      .expect(200);

    return verifyRes.body.token;
  }

  // Helper: plain signin (no 2FA), returns a fresh auth token
  async function plainSigninForToken(): Promise<string> {
    const res = await request(context.app)
      .post('/api/v2/auth/user/signin')
      .send({
        email: defaultUserArgs.email,
        password: defaultUserArgs.password,
      })
      .expect(200);
    return res.body.token;
  }

  // Helper: fully enable 2FA (setup + verify) and refresh context.token.
  // verify-setup rotates token_version, so the existing context.token is invalidated.
  async function enable2FA() {
    const setupData = await setup2FA();
    const code = await generateTotpCode(setupData.secret);

    await request(context.app)
      .post('/api/v2/auth/mfa/verify-setup')
      .set('xc-auth', context.token)
      .send({ code })
      .expect(200);

    context.token = await mfaSigninForToken(setupData.secret);

    return setupData;
  }

  // --- Setup ---

  describe('MFA Setup', () => {
    it('should return QR code, secret, and backup codes', async () => {
      const data = await setup2FA();

      expect(data.secret).to.be.a('string').with.length.greaterThan(10);
      expect(data.qrUrl).to.be.a('string').that.includes('data:image/png');
      expect(data.backupCodes).to.be.an('array').with.lengthOf(10);
      data.backupCodes.forEach((code: string) => {
        expect(code).to.match(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
      });
    });

    it('should reject with wrong password', async () => {
      await request(context.app)
        .post('/api/v2/auth/mfa/setup')
        .set('xc-auth', context.token)
        .send({ password: 'wrongPassword123!' })
        .expect(400);
    });

    it('should reject if 2FA already enabled', async () => {
      await enable2FA();

      await request(context.app)
        .post('/api/v2/auth/mfa/setup')
        .set('xc-auth', context.token)
        .send({ password: defaultUserArgs.password })
        .expect(400);
    });

    it('should reject without auth token', async () => {
      await request(context.app)
        .post('/api/v2/auth/mfa/setup')
        .send({ password: defaultUserArgs.password })
        .expect(401);
    });
  });

  // --- Verify Setup ---

  describe('MFA Verify Setup', () => {
    it('should enable 2FA with valid TOTP code', async () => {
      const setupData = await setup2FA();
      const code = await generateTotpCode(setupData.secret);

      const res = await request(context.app)
        .post('/api/v2/auth/mfa/verify-setup')
        .set('xc-auth', context.token)
        .send({ code })
        .expect(200);

      expect(res.body.msg).to.include('enabled');
    });

    it('should reject invalid TOTP code', async () => {
      await setup2FA();

      await request(context.app)
        .post('/api/v2/auth/mfa/verify-setup')
        .set('xc-auth', context.token)
        .send({ code: '000000' })
        .expect(400);
    });

    it('should reject if setup not initiated', async () => {
      await request(context.app)
        .post('/api/v2/auth/mfa/verify-setup')
        .set('xc-auth', context.token)
        .send({ code: '123456' })
        .expect(400);
    });
  });

  // --- Status ---

  describe('MFA Status', () => {
    it('should return enabled: false when 2FA not set up', async () => {
      const res = await request(context.app)
        .get('/api/v2/auth/mfa/status')
        .set('xc-auth', context.token)
        .expect(200);

      expect(res.body.enabled).to.equal(false);
    });

    it('should return enabled: true when 2FA is active', async () => {
      await enable2FA();

      const res = await request(context.app)
        .get('/api/v2/auth/mfa/status')
        .set('xc-auth', context.token)
        .expect(200);

      expect(res.body.enabled).to.equal(true);
    });

    it('should return eligible: true for a default local-password user', async () => {
      const res = await request(context.app)
        .get('/api/v2/auth/mfa/status')
        .set('xc-auth', context.token)
        .expect(200);

      // Bare local-password account — not tagged as Cognito-federated,
      // so enrolment is allowed.
      expect(res.body.eligible).to.equal(true);
      expect(res.body.ineligibleReason).to.equal(undefined);
    });

    it('should return eligible: false for a Cognito-federated user', async () => {
      // Tag the user as federated directly on `nc_users.meta`, mimicking
      // what the Cognito strategy would write on a Google sign-in.
      const { User } = await import('~/models');
      const user = await User.getByEmail(defaultUserArgs.email);
      await User.update(user.id, {
        meta: {
          ...(user.meta ?? {}),
          cognito_identity_type: 'federated',
          cognito_federation_provider: 'Google',
        },
      });

      const res = await request(context.app)
        .get('/api/v2/auth/mfa/status')
        .set('xc-auth', context.token)
        .expect(200);

      expect(res.body.eligible).to.equal(false);
      expect(res.body.ineligibleReason).to.equal('federated');
      expect(res.body.federationProvider).to.equal('Google');
    });

    it('should reject /setup for a Cognito-federated user', async () => {
      const { User } = await import('~/models');
      const user = await User.getByEmail(defaultUserArgs.email);
      await User.update(user.id, {
        meta: {
          ...(user.meta ?? {}),
          cognito_identity_type: 'federated',
          cognito_federation_provider: 'Google',
        },
      });

      // Even with a correct password, federated users cannot enrol —
      // backend short-circuits before the bcrypt/Cognito branch.
      const res = await request(context.app)
        .post('/api/v2/auth/mfa/setup')
        .set('xc-auth', context.token)
        .send({ password: defaultUserArgs.password });

      expect(res.status).to.equal(403);
    });
  });

  // --- Signin with 2FA ---

  describe('MFA Signin', () => {
    it('should return twoFactorRequired when 2FA enabled', async () => {
      await enable2FA();

      const res = await request(context.app)
        .post('/api/v2/auth/user/signin')
        .send({
          email: defaultUserArgs.email,
          password: defaultUserArgs.password,
        })
        .expect(200);

      expect(res.body.twoFactorRequired).to.equal(true);
      expect(res.body.twoFactorToken).to.be.a('string');
      expect(res.body.token).to.be.undefined;
    });

    it('should complete signin with valid TOTP code', async () => {
      const setupData = await enable2FA();

      // Get the twoFactorToken
      const signinRes = await request(context.app)
        .post('/api/v2/auth/user/signin')
        .send({
          email: defaultUserArgs.email,
          password: defaultUserArgs.password,
        })
        .expect(200);

      const code = await generateTotpCode(setupData.secret);

      const verifyRes = await request(context.app)
        .post('/api/v2/auth/mfa/verify')
        .send({
          token: signinRes.body.twoFactorToken,
          code,
        })
        .expect(200);

      expect(verifyRes.body.token).to.be.a('string');
    });

    it('should reject invalid TOTP code during signin', async () => {
      await enable2FA();

      const signinRes = await request(context.app)
        .post('/api/v2/auth/user/signin')
        .send({
          email: defaultUserArgs.email,
          password: defaultUserArgs.password,
        })
        .expect(200);

      await request(context.app)
        .post('/api/v2/auth/mfa/verify')
        .send({
          token: signinRes.body.twoFactorToken,
          code: '000000',
        })
        .expect(400);
    });

    it('should complete signin with valid backup code', async () => {
      const setupData = await enable2FA();

      const signinRes = await request(context.app)
        .post('/api/v2/auth/user/signin')
        .send({
          email: defaultUserArgs.email,
          password: defaultUserArgs.password,
        })
        .expect(200);

      const verifyRes = await request(context.app)
        .post('/api/v2/auth/mfa/verify')
        .send({
          token: signinRes.body.twoFactorToken,
          code: setupData.backupCodes[0],
        })
        .expect(200);

      expect(verifyRes.body.token).to.be.a('string');
    });

    it('should reject used backup code on second attempt', async () => {
      const setupData = await enable2FA();
      const backupCode = setupData.backupCodes[0];

      // First signin with backup code
      const signinRes1 = await request(context.app)
        .post('/api/v2/auth/user/signin')
        .send({
          email: defaultUserArgs.email,
          password: defaultUserArgs.password,
        })
        .expect(200);

      await request(context.app)
        .post('/api/v2/auth/mfa/verify')
        .send({ token: signinRes1.body.twoFactorToken, code: backupCode })
        .expect(200);

      // Wait for async backup code consumption
      await new Promise((r) => setTimeout(r, 500));

      // Second signin with same backup code
      const signinRes2 = await request(context.app)
        .post('/api/v2/auth/user/signin')
        .send({
          email: defaultUserArgs.email,
          password: defaultUserArgs.password,
        })
        .expect(200);

      await request(context.app)
        .post('/api/v2/auth/mfa/verify')
        .send({ token: signinRes2.body.twoFactorToken, code: backupCode })
        .expect(400);
    });

    it('should reject expired/invalid twoFactorToken', async () => {
      await request(context.app)
        .post('/api/v2/auth/mfa/verify')
        .send({ token: 'invalid.jwt.token', code: '123456' })
        .expect(400);
    });

    it('second MFA verify invalidates JWT from first MFA verify', async () => {
      // Confirms that mfaVerify mints the JWT AFTER setRefreshToken rotates
      // token_version. If the JWT were minted before rotation, the second
      // verify's token would carry the now-old version and fail validation
      // immediately — so the second token working is the proof.
      //
      // /auth/user/me falls back to a guest user on JWT failure (returns 200
      // with roles.guest: true), so we assert via response body rather than
      // status code.
      const setupData = await enable2FA();

      const isJwtValid = async (token: string) => {
        const res = await request(context.app)
          .get('/api/v1/auth/user/me')
          .set('xc-auth', token)
          .expect(200);
        return (
          res.body?.email === defaultUserArgs.email && !res.body?.roles?.guest
        );
      };

      const firstToken = await mfaSigninForToken(setupData.secret);
      expect(await isJwtValid(firstToken), 'first MFA token valid').to.be.true;

      // Second MFA verify — rotates token_version + clears prior refresh tokens
      const secondToken = await mfaSigninForToken(setupData.secret);

      expect(await isJwtValid(firstToken), 'first MFA token invalidated').to.be
        .false;
      expect(await isJwtValid(secondToken), 'second MFA token valid').to.be
        .true;
    });
  });

  // --- Disable ---

  describe('MFA Disable', () => {
    it('should disable 2FA with correct password', async () => {
      await enable2FA();

      const res = await request(context.app)
        .post('/api/v2/auth/mfa/disable')
        .set('xc-auth', context.token)
        .send({ password: defaultUserArgs.password })
        .expect(200);

      expect(res.body.msg).to.include('disabled');

      // disable rotates token_version — refresh the session token
      context.token = await plainSigninForToken();

      // Verify status is now false
      const statusRes = await request(context.app)
        .get('/api/v2/auth/mfa/status')
        .set('xc-auth', context.token)
        .expect(200);

      expect(statusRes.body.enabled).to.equal(false);
    });

    it('should allow normal signin after disable', async () => {
      await enable2FA();

      // Disable
      await request(context.app)
        .post('/api/v2/auth/mfa/disable')
        .set('xc-auth', context.token)
        .send({ password: defaultUserArgs.password })
        .expect(200);

      // Signin should return token directly (no twoFactorRequired)
      const res = await request(context.app)
        .post('/api/v2/auth/user/signin')
        .send({
          email: defaultUserArgs.email,
          password: defaultUserArgs.password,
        })
        .expect(200);

      expect(res.body.token).to.be.a('string');
      expect(res.body.twoFactorRequired).to.be.undefined;
    });

    it('should reject with wrong password', async () => {
      await enable2FA();

      await request(context.app)
        .post('/api/v2/auth/mfa/disable')
        .set('xc-auth', context.token)
        .send({ password: 'wrongPassword123!' })
        .expect(400);
    });

    it('should reject without password', async () => {
      await enable2FA();

      await request(context.app)
        .post('/api/v2/auth/mfa/disable')
        .set('xc-auth', context.token)
        .expect(400);
    });

    it('should reject if 2FA not enabled', async () => {
      await request(context.app)
        .post('/api/v2/auth/mfa/disable')
        .set('xc-auth', context.token)
        .send({ password: defaultUserArgs.password })
        .expect(400);
    });
  });

  // --- Regenerate Backup Codes ---

  describe('MFA Regenerate Backup Codes', () => {
    it('should generate new backup codes', async () => {
      const setupData = await enable2FA();
      const code = await generateTotpCode(setupData.secret);

      const res = await request(context.app)
        .post('/api/v2/auth/mfa/regenerate-backup-codes')
        .set('xc-auth', context.token)
        .send({ code })
        .expect(200);

      expect(res.body.backupCodes).to.be.an('array').with.lengthOf(10);
      // New codes should differ from original
      expect(res.body.backupCodes).to.not.deep.equal(setupData.backupCodes);
    });

    it('should invalidate old backup codes after regeneration', async () => {
      const setupData = await enable2FA();
      const oldBackupCode = setupData.backupCodes[0];

      // Regenerate
      const code = await generateTotpCode(setupData.secret);
      await request(context.app)
        .post('/api/v2/auth/mfa/regenerate-backup-codes')
        .set('xc-auth', context.token)
        .send({ code })
        .expect(200);

      // Try signin with old backup code
      const signinRes = await request(context.app)
        .post('/api/v2/auth/user/signin')
        .send({
          email: defaultUserArgs.email,
          password: defaultUserArgs.password,
        })
        .expect(200);

      await request(context.app)
        .post('/api/v2/auth/mfa/verify')
        .send({ token: signinRes.body.twoFactorToken, code: oldBackupCode })
        .expect(400);
    });

    it('should reject if 2FA not enabled', async () => {
      await request(context.app)
        .post('/api/v2/auth/mfa/regenerate-backup-codes')
        .set('xc-auth', context.token)
        .send({ code: '123456' })
        .expect(400);
    });

    it('should reject with invalid TOTP code', async () => {
      await enable2FA();

      await request(context.app)
        .post('/api/v2/auth/mfa/regenerate-backup-codes')
        .set('xc-auth', context.token)
        .send({ code: '000000' })
        .expect(400);
    });
  });
  // --- Force 2FA (Workspace-level) ---
  // Workspace owners are NOT exempt from force_2fa — otherwise an admin who
  // flips the toggle on can keep accessing the workspace themselves without
  // a second factor while all other members get blocked. The default user
  // created by init() is the workspace owner, which is exactly the case we
  // want to assert.
  describe('Force 2FA Workspace Enforcement', () => {
    if (!isEE()) return;

    let featureMock: { restore: () => Promise<void> | void } | undefined;

    afterEach(async () => {
      await featureMock?.restore();
      featureMock = undefined;
    });

    async function enableForce2fa() {
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: PlanFeatureTypes.FEATURE_FORCE_2FA,
        allowed: true,
      });
      await Workspace.update(context.fk_workspace_id, {
        meta: { force_2fa: true },
      });
    }

    function readWorkspace(token: string) {
      // /api/v1/workspaces/:id has no plan-feature gating beyond ACL, so it
      // exercises the AclMiddleware 2FA check cleanly. v3 metaApi routes
      // additionally require FEATURE_API_MEMBER_MANAGEMENT, which would
      // confuse "did the 2FA check fire?" with "is that feature on?".
      return request(context.app)
        .get(`/api/v1/workspaces/${context.fk_workspace_id}`)
        .set('xc-auth', token);
    }

    it('blocks workspace owner without 2FA when force_2fa is enabled', async () => {
      await enableForce2fa();

      const res = await readWorkspace(context.token);

      expect(res.status).to.equal(403);
      expect(JSON.stringify(res.body)).to.match(/two-factor|2fa/i);
    });

    it('allows workspace owner with 2FA when force_2fa is enabled', async () => {
      await enable2FA();
      await enableForce2fa();

      await readWorkspace(context.token).expect(200);
    });

    it('allows workspace owner without 2FA when force_2fa is disabled on the workspace', async () => {
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: PlanFeatureTypes.FEATURE_FORCE_2FA,
        allowed: true,
      });
      // meta.force_2fa stays unset/false on the workspace — gate skips.

      await readWorkspace(context.token).expect(200);
    });

    it('allows workspace owner without 2FA when the plan feature is unavailable', async () => {
      // Plan does not grant FEATURE_FORCE_2FA, even though meta says force_2fa.
      featureMock = await overrideFeature({
        workspace_id: context.fk_workspace_id,
        feature: PlanFeatureTypes.FEATURE_FORCE_2FA,
        allowed: false,
      });
      await Workspace.update(context.fk_workspace_id, {
        meta: { force_2fa: true },
      });

      await readWorkspace(context.token).expect(200);
    });
  });
}

export default function () {
  describe('MFA', mfaTests);
}
