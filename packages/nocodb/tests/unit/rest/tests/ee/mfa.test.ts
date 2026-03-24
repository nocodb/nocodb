import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import init from '../../../init';
import { defaultUserArgs } from '../../../factory/user';

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

  // Helper: fully enable 2FA (setup + verify)
  async function enable2FA() {
    const setupData = await setup2FA();
    const code = await generateTotpCode(setupData.secret);

    await request(context.app)
      .post('/api/v2/auth/mfa/verify-setup')
      .set('xc-auth', context.token)
      .send({ code })
      .expect(200);

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

    it('should reject without password', async () => {
      await request(context.app)
        .post('/api/v2/auth/mfa/setup')
        .set('xc-auth', context.token)
        .send({})
        .expect(400);
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
  });

  // --- Disable ---

  describe('MFA Disable', () => {
    it('should disable 2FA', async () => {
      await enable2FA();

      const res = await request(context.app)
        .post('/api/v2/auth/mfa/disable')
        .set('xc-auth', context.token)
        .expect(200);

      expect(res.body.msg).to.include('disabled');

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

    it('should reject if 2FA not enabled', async () => {
      await request(context.app)
        .post('/api/v2/auth/mfa/disable')
        .set('xc-auth', context.token)
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
  // These tests require a multi-user workspace setup (owner + non-owner member)
  // because workspace owners are exempt from force 2FA enforcement.
  // The middleware enforcement is tested via manual/E2E testing:
  // 1. Set workspace meta.force_2fa = true
  // 2. Non-owner member without 2FA → 403 ERR_MFA_SETUP_REQUIRED
  // 3. Non-owner member with 2FA → allowed
  // 4. Workspace owner without 2FA → allowed (exempt)
}

export default function () {
  describe('MFA', mfaTests);
}
