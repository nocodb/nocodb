import { expect } from 'chai';
import 'mocha';
import sinon from 'sinon';
import { ConfigService } from '@nestjs/config';
import { CognitoStrategy } from '~/ee/strategies/cognito.strategy/cognito.strategy';
import { UsersService } from '~/services/users/users.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { User } from '~/models';
import { isEE } from '../utils/helpers';

/**
 * Pure-unit coverage for the TEST=true short-circuit added to the
 * Cognito passport strategy. We exercise `validate()` directly with a
 * fake passport callback and stub `User.getByEmail` /
 * `UsersService.registerNewUserIfAllowed`, mirroring the mocking
 * pattern in `mfa.test.ts`.
 *
 * Matrix:
 *   1. TEST !== 'true'                 → real strategy runs (no header bypass)
 *   2. TEST === 'true', header present → synthetic identity used
 *   3. TEST === 'true', header absent  → real strategy runs (existing
 *                                        tests of the real strategy
 *                                        don't break)
 */
export function cognitoTestShimTests() {
  if (!isEE()) return;

  describe('CognitoStrategy — TEST-mode shim', () => {
    let strategy: CognitoStrategy;
    let configService: { get: sinon.SinonStub };
    let usersService: { registerNewUserIfAllowed: sinon.SinonStub };
    let appHooksService: { emit: sinon.SinonStub };
    let userGetByEmailStub: sinon.SinonStub;
    let originalTestEnv: string | undefined;

    beforeEach(() => {
      originalTestEnv = process.env.TEST;

      configService = {
        // Real strategy bails out early with "Cognito is not configured"
        // when this returns falsy — we use that as the "real strategy
        // was invoked" sentinel below.
        get: sinon.stub().returns(undefined),
      };
      usersService = {
        registerNewUserIfAllowed: sinon.stub(),
      };
      appHooksService = { emit: sinon.stub() };

      strategy = new CognitoStrategy(
        configService as unknown as ConfigService,
        usersService as unknown as UsersService,
        appHooksService as unknown as AppHooksService,
      );

      userGetByEmailStub = sinon.stub(User, 'getByEmail');
    });

    afterEach(() => {
      sinon.restore();
      if (originalTestEnv === undefined) {
        delete process.env.TEST;
      } else {
        process.env.TEST = originalTestEnv;
      }
    });

    // Wraps the callback-style `validate(req, cb)` into a promise so we
    // can `await` it in tests.
    function runValidate(req: any): Promise<{ err: unknown; user: unknown }> {
      return new Promise((resolve) => {
        strategy.validate(req, (err: unknown, user?: unknown) => {
          resolve({ err, user: user ?? null });
        });
      });
    }

    it('TEST!=true → shim is inert (real strategy runs even when xc-cognito-test header is present)', async () => {
      delete process.env.TEST;

      const req = {
        headers: {
          'xc-cognito-test': JSON.stringify({ email: 'a@b.com' }),
        },
      };

      const { err, user } = await runValidate(req);

      // Real strategy hits its "Cognito is not configured" branch
      // because the ConfigService stub returns undefined. That's our
      // proof the shim did NOT take over.
      expect(err, 'real strategy should reject with error').to.exist;
      expect((err as Error).message).to.equal('Cognito is not configured');
      expect(user).to.be.null;
      // Shim path never queries the DB.
      expect(userGetByEmailStub.called).to.be.false;
    });

    it('TEST=true AND xc-cognito-test present → synthetic identity used (existing user)', async () => {
      process.env.TEST = 'true';

      userGetByEmailStub.resolves({
        id: 'usr_existing',
        email: 'existing@example.com',
        display_name: 'Existing',
        password: null,
      } as any);

      const req = {
        headers: {
          'xc-cognito-test': JSON.stringify({
            email: 'existing@example.com',
            displayName: 'Existing',
          }),
        },
      };

      const { err, user } = await runValidate(req);

      expect(err).to.be.null;
      expect(user).to.be.an('object');
      expect((user as any).provider).to.equal('cognito');
      expect((user as any).id).to.equal('usr_existing');
      // Real strategy's User Pool ID config check must NOT run when
      // the shim takes over.
      expect(configService.get.called, 'real strategy must be bypassed').to.be
        .false;
      // No registration call — user existed.
      expect(usersService.registerNewUserIfAllowed.called).to.be.false;
    });

    it('TEST=true AND xc-cognito-test present → registers a new user when not found', async () => {
      process.env.TEST = 'true';

      userGetByEmailStub.resolves(null);
      usersService.registerNewUserIfAllowed.resolves({
        id: 'usr_new',
        email: 'new@example.com',
        display_name: 'New',
        password: null,
      } as any);

      const req = {
        headers: {
          'xc-cognito-test': JSON.stringify({
            email: 'new@example.com',
            displayName: 'New',
          }),
        },
      };

      const { err, user } = await runValidate(req);

      expect(err).to.be.null;
      expect((user as any).id).to.equal('usr_new');
      expect(usersService.registerNewUserIfAllowed.calledOnce).to.be.true;

      const args = usersService.registerNewUserIfAllowed.getCall(0).args[0];
      expect(args.email).to.equal('new@example.com');
      expect(args.display_name).to.equal('New');
      expect(args.password).to.equal('');
    });

    it('TEST=true AND firstTimeUser:true → forces register branch even if user exists', async () => {
      process.env.TEST = 'true';

      // Existing user in DB — should NOT be consulted thanks to
      // firstTimeUser: true bypassing the lookup.
      userGetByEmailStub.resolves({
        id: 'usr_existing',
        email: 'first@example.com',
        password: null,
      } as any);
      usersService.registerNewUserIfAllowed.resolves({
        id: 'usr_registered',
        email: 'first@example.com',
        password: null,
      } as any);

      const req = {
        headers: {
          'xc-cognito-test': JSON.stringify({
            email: 'first@example.com',
            firstTimeUser: true,
          }),
        },
      };

      const { err, user } = await runValidate(req);

      expect(err).to.be.null;
      expect(userGetByEmailStub.called).to.be.false;
      expect(usersService.registerNewUserIfAllowed.calledOnce).to.be.true;
      expect((user as any).id).to.equal('usr_registered');
    });

    it('TEST=true but xc-cognito-test header absent → real strategy still runs', async () => {
      process.env.TEST = 'true';

      const req = { headers: {} };

      const { err, user } = await runValidate(req);

      // Real strategy's "Cognito is not configured" branch triggered —
      // proof we did NOT short-circuit when the header was absent.
      expect(err).to.exist;
      expect((err as Error).message).to.equal('Cognito is not configured');
      expect(user).to.be.null;
      expect(userGetByEmailStub.called).to.be.false;
    });

    it('TEST=true AND both headers present → real strategy runs (xc-cognito wins)', async () => {
      // If a request carries the real `xc-cognito` JWT header AND the
      // synthetic test header, prefer the real strategy. Defense
      // against a misconfigured harness leaking the test bypass into
      // a real Cognito sign-in.
      process.env.TEST = 'true';

      const req = {
        headers: {
          'xc-cognito': 'fake.real.jwt',
          'xc-cognito-test': JSON.stringify({ email: 'a@b.com' }),
        },
      };

      const { err, user } = await runValidate(req);

      expect(err).to.exist;
      expect((err as Error).message).to.equal('Cognito is not configured');
      expect(user).to.be.null;
      expect(userGetByEmailStub.called).to.be.false;
    });

    it('TEST=true, header present but malformed JSON → callback errors, no DB call', async () => {
      process.env.TEST = 'true';

      const req = {
        headers: { 'xc-cognito-test': 'not-json-at-all' },
      };

      const { err, user } = await runValidate(req);

      expect(err).to.exist;
      expect((err as Error).message).to.match(/Invalid xc-cognito-test header/);
      expect(user).to.be.null;
      expect(userGetByEmailStub.called).to.be.false;
    });

    it('TEST=true, header present but no email field → callback errors', async () => {
      process.env.TEST = 'true';

      const req = {
        headers: {
          'xc-cognito-test': JSON.stringify({ displayName: 'No Email' }),
        },
      };

      const { err, user } = await runValidate(req);

      expect(err).to.exist;
      expect((err as Error).message).to.match(/no email/);
      expect(user).to.be.null;
      expect(userGetByEmailStub.called).to.be.false;
    });
  });
}
