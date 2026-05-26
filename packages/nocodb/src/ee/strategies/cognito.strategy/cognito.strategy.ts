import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { AppEvents } from 'nocodb-sdk';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import type { AppConfig } from '~/interface/config';
import { sanitiseUserObj } from '~/utils';
import { UsersService } from '~/services/users/users.service';
import { User } from '~/models';
import { isDisposableEmail } from '~/helpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

/**
 * Inspect a Cognito ID-token payload to determine whether the user is
 * `'native'` (signed up directly with email+password in our User Pool)
 * or `'federated'` (signed in via Google / SAML / etc.). Federated
 * tokens carry an `identities[]` array whose first entry names the
 * upstream provider. Native tokens omit the claim entirely.
 *
 * Used to gate NocoDB-side 2FA enrolment: only native users can be
 * password-re-verified by us via Cognito's `InitiateAuth`, so federated
 * users are pointed back to their IdP for MFA. See
 * `mfa.service.setup` and `Security.vue:canSetup2fa`.
 */
function extractCognitoIdentity(payload: any): {
  type: 'native' | 'federated';
  provider?: string;
} {
  const identities = payload?.identities;
  if (Array.isArray(identities) && identities.length > 0) {
    return {
      type: 'federated',
      provider: identities[0]?.providerName ?? identities[0]?.providerType,
    };
  }
  return { type: 'native' };
}

@Injectable()
export class CognitoStrategy extends PassportStrategy(Strategy, 'cognito') {
  constructor(
    private configService: ConfigService<AppConfig>,
    private usersService: UsersService,
    private appHooksService: AppHooksService,
  ) {
    super();
  }

  async validate(req: any, callback) {
    try {
      // ─── Test-mode shim ────────────────────────────────────────────────
      // When TEST=true AND the request carries the synthetic
      // `xc-cognito-test` header (NOT the real `xc-cognito` JWT header),
      // short-circuit the real passport-cognito strategy. Lets playwright
      // / harnesses drive the Cognito sign-in flow without configuring an
      // AWS Cognito User Pool.
      //
      // Same `TEST=true` gate as DbMux / sandbox / audit (see
      // packages/nocodb/src/ee/models/DbMux.ts:302). The env var is only
      // set by the test runners; production builds never trip this path.
      //
      // We do NOT expose this branch when the header is absent — falling
      // through means existing tests of the real strategy keep working.
      if (
        process.env.TEST === 'true' &&
        req.headers['xc-cognito-test'] &&
        !req.headers['xc-cognito']
      ) {
        return this.testModeValidate(req, callback);
      }

      if (
        !this.configService.get('cognito.aws_user_pools_id', { infer: true })
      ) {
        this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
          provider: 'cognito',
          reason: 'Cognito is not configured',
          req,
        });
        return callback(new Error('Cognito is not configured'));
      }

      if (req.headers['xc-cognito']) {
        const verifier = CognitoJwtVerifier.create({
          userPoolId: this.configService.get('cognito.aws_user_pools_id', {
            infer: true,
          }),
          tokenUse: 'id',
          clientId: this.configService.get(
            'cognito.aws_user_pools_web_client_id',
            { infer: true },
          ),
        });

        const payload = await verifier.verify(req.headers['xc-cognito']);
        const rawEmail = (payload as any)['email']?.toLowerCase();

        if (!rawEmail) {
          this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
            provider: 'cognito',
            reason: 'Invalid token - no email',
            req,
          });
          return callback('Invalid token');
        }

        // Reject plus addressing (always abusive)
        if (rawEmail.split('@')[0].includes('+')) {
          this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
            email: rawEmail,
            provider: 'cognito',
            reason: 'Plus addressing not allowed',
            req,
          });
          return callback(
            new Error(
              'Email aliases with "+" are not allowed. Please use your primary email address.',
            ),
          );
        }

        // check if email is disposable and throw error
        if (isDisposableEmail(rawEmail)) {
          this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
            email: rawEmail,
            provider: 'cognito',
            reason: 'Disposable email',
            req,
          });
          return callback(
            new Error(
              'For the security and integrity of NocoDB platform, we require users to sign up with a permanent email address. Please provide a valid, long-term email address to continue.',
            ),
          );
        }

        // Decide native-vs-federated up-front so we can persist the
        // tag on the user record below — `mfa.service.setup` reads
        // it back to gate enrolment (only native users can be
        // re-verified against Cognito's password store).
        const identity = extractCognitoIdentity(payload);

        // Login: use exact email match to avoid returning wrong user
        const user = await User.getByEmail(rawEmail);

        if (user) {
          await this.persistCognitoIdentityTag(user, identity);
          return callback(null, {
            ...sanitiseUserObj(user),
            provider: 'cognito',
          });
        }

        try {
          // if user not found create new user
          const salt = await promisify(bcrypt.genSalt)(10);
          const newUser = await this.usersService.registerNewUserIfAllowed({
            email: rawEmail,
            password: '',
            email_verification_token: null,
            avatar: (payload as any)['picture'],
            user_name: null,
            display_name: (payload as any)['name'],
            salt,
            req,
          });
          await this.persistCognitoIdentityTag(newUser, identity);

          return callback(null, {
            ...sanitiseUserObj(newUser),
            provider: 'cognito',
          });
        } catch (err) {
          this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
            email: rawEmail,
            provider: 'cognito',
            reason: 'Registration failed',
            req,
          });
          return callback(new Error('Token validation failed'));
        }
      } else {
        this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
          provider: 'cognito',
          reason: 'No token found',
          req,
        });
        return callback(new Error('No token found'));
      }
    } catch (error) {
      this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
        provider: 'cognito',
        reason: 'Token verification failed',
        req,
      });
      return callback(error);
    }
  }

  /**
   * Test-mode-only short-circuit. Mirrors the get-or-create user shape of
   * the real `validate()` above, minus the JWT verification + disposable /
   * plus-addressing rejections (we trust the test harness).
   *
   * Header envelope shape: JSON string with `{ email, displayName?,
   * firstTimeUser? }`. `firstTimeUser: true` forces the registration
   * branch (useful for tests that want to assert "first-time" flow even
   * if the email previously existed in the test DB).
   *
   * Reachable only when `process.env.TEST === 'true'` (caller-guarded).
   */
  private async testModeValidate(req: any, callback) {
    // Belt-and-braces: never run this in production even if a caller
    // somehow invokes the method directly.
    if (process.env.TEST !== 'true') {
      return callback(new Error('test-mode shim invoked outside TEST=true'));
    }

    let envelope: {
      email?: string;
      displayName?: string;
      firstTimeUser?: boolean;
    };
    try {
      envelope = JSON.parse(req.headers['xc-cognito-test'] as string);
    } catch (_e) {
      return callback(new Error('Invalid xc-cognito-test header (not JSON)'));
    }

    const rawEmail = envelope?.email?.toLowerCase();
    if (!rawEmail) {
      return callback(new Error('Invalid xc-cognito-test header (no email)'));
    }

    // Try existing user first — same login-first / register-second order
    // as the real strategy. `firstTimeUser: true` forces the register
    // branch for tests that want to exercise the new-user code path.
    if (!envelope.firstTimeUser) {
      const user = await User.getByEmail(rawEmail);
      if (user) {
        return callback(null, {
          ...sanitiseUserObj(user),
          provider: 'cognito',
        });
      }
    }

    try {
      const salt = await promisify(bcrypt.genSalt)(10);
      const newUser = await this.usersService.registerNewUserIfAllowed({
        email: rawEmail,
        password: '',
        email_verification_token: null,
        avatar: null,
        user_name: null,
        display_name: envelope.displayName ?? null,
        salt,
        req,
      });

      return callback(null, {
        ...sanitiseUserObj(newUser),
        provider: 'cognito',
      });
    } catch (err) {
      return callback(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Stash the user's Cognito identity flavour on `nc_users.meta` so
   * `mfa.service.setup` and `/api/v2/auth/mfa/status` can read it back
   * without re-decoding the Cognito JWT (which only the strategy sees).
   * Idempotent — no-op when the tag already matches.
   *
   * `meta.cognito_identity_type`: 'native' | 'federated'
   * `meta.cognito_federation_provider`: 'Google' | 'SAML' | ... (federated only)
   */
  private async persistCognitoIdentityTag(
    user: { id: string; meta?: any },
    identity: { type: 'native' | 'federated'; provider?: string },
  ): Promise<void> {
    try {
      const existing =
        typeof user.meta === 'string'
          ? JSON.parse(user.meta || '{}')
          : user.meta || {};

      if (
        existing.cognito_identity_type === identity.type &&
        existing.cognito_federation_provider ===
          (identity.provider ?? undefined)
      ) {
        return;
      }

      const meta = {
        ...existing,
        cognito_identity_type: identity.type,
        ...(identity.type === 'federated'
          ? { cognito_federation_provider: identity.provider }
          : { cognito_federation_provider: undefined }),
      };

      await User.update(user.id, { meta });
    } catch (_e) {
      // Best-effort — a meta-write failure shouldn't block sign-in.
      // Worst case: the next sign-in re-tries the write.
    }
  }
}

export const CognitoStrategyProvider: FactoryProvider = {
  provide: CognitoStrategy,
  inject: [UsersService, ConfigService<AppConfig>, AppHooksService],
  useFactory: async (
    usersService: UsersService,
    config: ConfigService<AppConfig>,
    appHooksService: AppHooksService,
  ) => {
    return new CognitoStrategy(config, usersService, appHooksService);
  },
};
