import { expect } from 'chai';
import 'mocha';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import sinon from 'sinon';
import {
  MfaService,
  generateBackupCodes,
  generateTwoFactorToken,
  normalizeCode,
} from '~/ee/services/mfa.service';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { User } from '~/models';
import { isEE } from '../utils/helpers';

// Pure-unit coverage for the MFA service helpers and the
// password-less-setup + redirect-threading behaviour that the
// Cognito-2FA work added. No DB, no Nest container — sinon stubs
// for User.get / Noco.ncMeta / NocoCache / Noco.getConfig and a
// shallow AppHooksService mock.
export function mfaHelperTests() {
if (!isEE()) return;

describe('MFA Helpers', () => {
  describe('Backup code generation', () => {
    it('should generate the requested number of codes', () => {
      const codes = generateBackupCodes(10);
      expect(codes).to.have.lengthOf(10);
    });

    it('should generate codes in xxxx-xxxx format', () => {
      const codes = generateBackupCodes(10);
      codes.forEach((code) => {
        expect(code).to.match(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
      });
    });

    it('should generate unique codes', () => {
      const codes = generateBackupCodes(10);
      const unique = new Set(codes);
      expect(unique.size).to.equal(codes.length);
    });

    it('should generate different sets each time', () => {
      const set1 = generateBackupCodes(10);
      const set2 = generateBackupCodes(10);
      expect(set1).to.not.deep.equal(set2);
    });
  });

  describe('Backup code normalization', () => {
    it('should strip dashes', () => {
      expect(normalizeCode('abcd-ef12')).to.equal('abcdef12');
    });

    it('should strip spaces', () => {
      expect(normalizeCode('abcd ef12')).to.equal('abcdef12');
    });

    it('should lowercase', () => {
      expect(normalizeCode('ABCD-EF12')).to.equal('abcdef12');
    });

    it('should handle mixed formatting', () => {
      expect(normalizeCode('Ab Cd-EF 12')).to.equal('abcdef12');
    });

    it('should match codes regardless of formatting', () => {
      const stored = 'a1b2-c3d4';
      const inputVariants = ['a1b2-c3d4', 'A1B2-C3D4', 'a1b2c3d4', 'a1b2 c3d4'];
      inputVariants.forEach((input) => {
        expect(normalizeCode(input)).to.equal(normalizeCode(stored));
      });
    });
  });

  describe('Two-factor token generation', () => {
    const testSecret = 'test-jwt-secret-for-mfa-unit-tests';

    it('should generate a valid JWT', () => {
      const token = generateTwoFactorToken(
        { id: 'user123', email: 'test@example.com' },
        { secret: testSecret },
      );
      expect(token).to.be.a('string');
      expect(token.split('.')).to.have.lengthOf(3);
    });

    it('should contain correct claims', () => {
      const token = generateTwoFactorToken(
        { id: 'user123', email: 'test@example.com' },
        { secret: testSecret },
      );
      const payload = jwt.verify(token, testSecret) as any;
      expect(payload.id).to.equal('user123');
      expect(payload.email).to.equal('test@example.com');
      expect(payload.purpose).to.equal('mfa');
    });

    it('should have 5-minute expiry', () => {
      const token = generateTwoFactorToken(
        { id: 'user123', email: 'test@example.com' },
        { secret: testSecret },
      );
      const payload = jwt.decode(token) as any;
      const expiresIn = payload.exp - payload.iat;
      expect(expiresIn).to.equal(300); // 5 minutes
    });

    it('should reject tokens with wrong secret', () => {
      const token = generateTwoFactorToken(
        { id: 'user123', email: 'test@example.com' },
        { secret: testSecret },
      );
      expect(() => jwt.verify(token, 'wrong-secret')).to.throw();
    });

    it('should not contain sensitive data', () => {
      const token = generateTwoFactorToken(
        { id: 'user123', email: 'test@example.com' },
        { secret: testSecret },
      );
      const payload = jwt.decode(token) as any;
      expect(payload).to.not.have.property('password');
      expect(payload).to.not.have.property('totp_secret');
    });

    // --- redirect claim (Cognito-2FA addition) -----------------------------

    it('omits the redirect claim when opts.redirect is not set', () => {
      const token = generateTwoFactorToken(
        { id: 'user123', email: 'test@example.com' },
        { secret: testSecret },
      );
      const payload = jwt.verify(token, testSecret) as any;
      expect(payload).to.not.have.property('redirect');
    });

    it('omits the redirect claim when no opts at all', () => {
      // Falls back to Noco.getConfig().auth.jwt.secret — stub it.
      const cfgStub = sinon
        .stub(Noco, 'getConfig')
        .returns({ auth: { jwt: { secret: testSecret } } } as any);
      try {
        const token = generateTwoFactorToken({
          id: 'user123',
          email: 'test@example.com',
        });
        const payload = jwt.verify(token, testSecret) as any;
        expect(payload).to.not.have.property('redirect');
      } finally {
        cfgStub.restore();
      }
    });

    it('embeds the redirect claim when opts.redirect is set', () => {
      const token = generateTwoFactorToken(
        { id: 'user123', email: 'test@example.com' },
        { secret: testSecret, redirect: '/dashboard/foo?x=1' },
      );
      const payload = jwt.verify(token, testSecret) as any;
      expect(payload.redirect).to.equal('/dashboard/foo?x=1');
      // Other claims still present
      expect(payload.id).to.equal('user123');
      expect(payload.purpose).to.equal('mfa');
    });

    it('treats empty-string redirect as not-set (falsy spread)', () => {
      // The implementation uses `...(opts?.redirect ? { redirect } : {})`
      // — empty string should NOT add the claim.
      const token = generateTwoFactorToken(
        { id: 'user123', email: 'test@example.com' },
        { secret: testSecret, redirect: '' },
      );
      const payload = jwt.verify(token, testSecret) as any;
      expect(payload).to.not.have.property('redirect');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // MfaService.setup — bcrypt re-confirm is now skipped for password-less
  // (SSO / Cognito) accounts. Both branches covered below via a shallow
  // mock of User / Noco.ncMeta / NocoCache + a no-op AppHooksService.
  // ────────────────────────────────────────────────────────────────────────
  describe('MfaService.setup — password re-confirm branches', () => {
    let appHooksMock: { emit: sinon.SinonStub };
    let service: MfaService;
    let userGetStub: sinon.SinonStub;
    let ncMetaStub: { metaUpdate: sinon.SinonStub };
    let cacheDelStub: sinon.SinonStub;
    let cfgStub: sinon.SinonStub;

    beforeEach(() => {
      appHooksMock = { emit: sinon.stub() };
      service = new MfaService(appHooksMock as any);

      userGetStub = sinon.stub(User, 'get');

      ncMetaStub = { metaUpdate: sinon.stub().resolves() };
      sinon.stub(Noco, 'ncMeta' as any).get(() => ncMetaStub);

      cacheDelStub = sinon.stub(NocoCache, 'del').resolves(undefined as any);

      // Some code paths inside helpers (encryptPropIfRequired, etc.)
      // call Noco.getConfig — keep it safe.
      cfgStub = sinon
        .stub(Noco, 'getConfig')
        .returns({ auth: { jwt: { secret: 'unit-test-secret' } } } as any);
    });

    afterEach(() => {
      sinon.restore();
      // suppress unused-variable lint
      void cfgStub;
      void cacheDelStub;
    });

    it('rejects setup when the user has no password and the session has no identity tag', async () => {
      // Post per-session-identity PR, a user with no local password
      // AND no `req.user.extra.cognito_identity_type` AND no
      // `sso_client_id` can't be re-proved — the legacy "session JWT
      // is the proof" fallthrough was a real regression (XSS / cookie
      // theft could enrol with no challenge). We refuse the setup
      // instead of silently allowing it.
      userGetStub.resolves({
        id: 'usr_sso',
        email: 'sso@example.com',
        password: null,
        totp_enabled: false,
        meta: null,
      } as any);

      const bcryptSpy = sinon.spy(bcrypt, 'compare');

      let thrown: Error | undefined;
      try {
        await service.setup(
          'usr_sso',
          'irrelevant',
          { user: { id: 'usr_sso' } } as any,
        );
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown, 'should reject zero-reproof setup').to.exist;
      expect(thrown!.message).to.match(/email and password/i);

      // bcrypt.compare must not run — there's nothing to compare.
      expect(bcryptSpy.called).to.be.false;

      // No state mutation when the gate rejects.
      expect(ncMetaStub.metaUpdate.called).to.be.false;
      expect(appHooksMock.emit.called).to.be.false;
    });

    it('rejects setup when user.password is an empty string and no Cognito tag', async () => {
      userGetStub.resolves({
        id: 'usr_sso2',
        email: 'sso2@example.com',
        password: '',
        totp_enabled: false,
        meta: null,
      } as any);

      const bcryptSpy = sinon.spy(bcrypt, 'compare');

      let thrown: Error | undefined;
      try {
        await service.setup(
          'usr_sso2',
          'irrelevant',
          { user: { id: 'usr_sso2' } } as any,
        );
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown, 'should reject zero-reproof setup').to.exist;
      expect(thrown!.message).to.match(/email and password/i);
      expect(bcryptSpy.called).to.be.false;
      expect(ncMetaStub.metaUpdate.called).to.be.false;
    });

    it('still bcrypt-compares when the user has a local password (success)', async () => {
      const password = 'correct-horse-battery-staple';
      const hash = await bcrypt.hash(password, 4);

      userGetStub.resolves({
        id: 'usr_local',
        email: 'local@example.com',
        password: hash,
        totp_enabled: false,
      } as any);

      const result = await service.setup(
        'usr_local',
        password,
        { user: { id: 'usr_local' } } as any,
      );

      expect(result).to.have.property('secret');
      expect(ncMetaStub.metaUpdate.calledOnce).to.be.true;
      expect(appHooksMock.emit.calledOnce).to.be.true;
    });

    it('still bcrypt-compares when the user has a local password (mismatch throws)', async () => {
      const password = 'correct-horse-battery-staple';
      const hash = await bcrypt.hash(password, 4);

      userGetStub.resolves({
        id: 'usr_local2',
        email: 'local2@example.com',
        password: hash,
        totp_enabled: false,
      } as any);

      let thrown: Error | undefined;
      try {
        await service.setup(
          'usr_local2',
          'WRONG-PASSWORD',
          { user: { id: 'usr_local2' } } as any,
        );
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown, 'should reject mismatched password').to.exist;
      expect(thrown!.message).to.match(/incorrect password/i);

      // metaUpdate must NOT run when the password check fails
      expect(ncMetaStub.metaUpdate.called).to.be.false;
      expect(appHooksMock.emit.called).to.be.false;
    });

    it('still rejects when 2FA is already enabled (regardless of password presence)', async () => {
      userGetStub.resolves({
        id: 'usr_already',
        email: 'already@example.com',
        password: null,
        totp_enabled: true,
      } as any);

      let thrown: Error | undefined;
      try {
        await service.setup(
          'usr_already',
          '',
          { user: { id: 'usr_already' } } as any,
        );
      } catch (e) {
        thrown = e as Error;
      }
      expect(thrown).to.exist;
      expect(thrown!.message).to.match(/already enabled/i);
      expect(ncMetaStub.metaUpdate.called).to.be.false;
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // MfaService.verifySignin — return shape now includes `redirect`,
  // sourced from the original 2FA token's claim.
  // ────────────────────────────────────────────────────────────────────────
  describe('MfaService.verifySignin — redirect threading', () => {
    const jwtSecret = 'verifySignin-unit-secret';
    let appHooksMock: { emit: sinon.SinonStub };
    let service: MfaService;
    let userGetStub: sinon.SinonStub;
    let cacheGetStub: sinon.SinonStub;
    let cacheDelStub: sinon.SinonStub;
    let cfgStub: sinon.SinonStub;
    let verifyCodeStub: sinon.SinonStub;

    beforeEach(() => {
      appHooksMock = { emit: sinon.stub() };
      service = new MfaService(appHooksMock as any);

      cfgStub = sinon
        .stub(Noco, 'getConfig')
        .returns({ auth: { jwt: { secret: jwtSecret } } } as any);

      userGetStub = sinon.stub(User, 'get').resolves({
        id: 'usr_verify',
        email: 'verify@example.com',
        totp_enabled: true,
        // Whatever — we stub verifyCode below so decryptSecret never runs
        // against a real OTP secret. Provide a non-null string so the
        // "is not configured" guard passes.
        totp_secret: 'placeholder-secret',
      } as any);

      // Lockout check + clear — no prior failures
      cacheGetStub = sinon
        .stub(NocoCache, 'get')
        .resolves(null as any);
      cacheDelStub = sinon
        .stub(NocoCache, 'del')
        .resolves(undefined as any);

      // Bypass otplib entirely — verifyCode is a private method on the
      // prototype that returns 'totp' | 'backup_code' | null.
      verifyCodeStub = sinon
        .stub(MfaService.prototype as any, 'verifyCode')
        .resolves('totp');
    });

    afterEach(() => {
      sinon.restore();
      void cacheGetStub;
      void cacheDelStub;
      void verifyCodeStub;
      void cfgStub;
    });

    it('returns redirect: undefined when token had no redirect claim', async () => {
      const token = generateTwoFactorToken(
        { id: 'usr_verify', email: 'verify@example.com' },
        { secret: jwtSecret },
      );

      const result = await service.verifySignin(token, '123456', {
        user: { id: 'usr_verify' },
      } as any);

      expect(result.userId).to.equal('usr_verify');
      expect(result.user).to.exist;
      expect(result).to.have.property('redirect');
      expect(result.redirect).to.be.undefined;
    });

    it('echoes back the redirect from the signed token', async () => {
      const token = generateTwoFactorToken(
        { id: 'usr_verify', email: 'verify@example.com' },
        { secret: jwtSecret, redirect: '/base/abc?tab=2' },
      );

      const result = await service.verifySignin(token, '123456', {
        user: { id: 'usr_verify' },
      } as any);

      expect(result.redirect).to.equal('/base/abc?tab=2');
      expect(result.userId).to.equal('usr_verify');
    });

    it('throws on an invalid token (no redirect leak)', async () => {
      let thrown: Error | undefined;
      try {
        await service.verifySignin('not.a.valid.token', '123456', {
          user: { id: 'x' },
        } as any);
      } catch (e) {
        thrown = e as Error;
      }
      expect(thrown).to.exist;
      // verifyCode must not have been reached
      expect(verifyCodeStub.called).to.be.false;
      // No user lookup either
      expect(userGetStub.called).to.be.false;
    });
  });
});
}
