import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { AppEvents } from 'nocodb-sdk';
import {
  AdminInitiateAuthCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { User } from '~/models';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { normalizeEmail } from '~/utils/emailUtils';
import { randomTokenString } from '~/services/users/helpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import {
  decryptPropIfRequired,
  encryptPropIfRequired,
} from '~/utils/encryptDecrypt';

export function normalizeCode(code: string): string {
  return code.replace(/[-\s]/g, '').toLowerCase();
}

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex');
    // Format as xxxx-xxxx for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

export function generateTwoFactorToken(
  user: { id: string; email: string },
  opts?: {
    secret?: string;
    redirect?: string;
    extra?: Record<string, any>;
  },
): string {
  const jwtSecret = opts?.secret ?? Noco.getConfig().auth.jwt.secret;
  // Carry an optional `redirect` (the URL the user was originally going
  // to) and an `extra` blob (sign-in-flow specific payload — e.g.
  // `continueAfterSignIn` set by the OpenID/Cognito strategies) inside
  // the token so the post-verify response can hand them back to the FE
  // without keeping any server-side session state. Sign-only, no
  // encryption — both fields must be treated as untrusted on the FE.
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      purpose: 'mfa',
      ...(opts?.redirect ? { redirect: opts.redirect } : {}),
      ...(opts?.extra ? { extra: opts.extra } : {}),
    },
    jwtSecret,
    { expiresIn: '5m' },
  );
}

@Injectable()
export class MfaService {
  protected logger = new Logger(MfaService.name);

  private readonly MFA_MAX_ATTEMPTS = 5;
  private readonly MFA_LOCKOUT_SECONDS = 15 * 60; // 15 minutes

  constructor(protected appHooksService: AppHooksService) {}

  private async checkMfaLockout(userId: string): Promise<void> {
    const attempts = await NocoCache.get(
      'root',
      `mfa_lockout:${userId}`,
      CacheGetType.TYPE_STRING,
    );

    if (attempts !== null && parseInt(attempts, 10) >= this.MFA_MAX_ATTEMPTS) {
      NcError.get().tooManyRequests(
        'Too many failed attempts. Please try again later.',
      );
    }
  }

  // Note: get+set is not atomic — concurrent failures may lose one increment.
  // Acceptable for a 5-attempt limit; NocoCache.incrby doesn't support TTL.
  private async incrementMfaFailure(userId: string): Promise<void> {
    const key = `mfa_lockout:${userId}`;
    const current = await NocoCache.get('root', key, CacheGetType.TYPE_STRING);

    const count = current !== null ? parseInt(current, 10) + 1 : 1;

    await NocoCache.setExpiring(
      'root',
      key,
      count.toString(),
      this.MFA_LOCKOUT_SECONDS,
    );
  }

  private async clearMfaLockout(userId: string): Promise<void> {
    await NocoCache.del('root', `mfa_lockout:${userId}`);
  }

  private async updateMfaFields(
    userId: string,
    fields: {
      totp_secret?: string | null;
      totp_enabled?: boolean;
      totp_backup_codes?: string | null;
    },
  ) {
    const user = await User.get(userId);

    await Noco.ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USERS,
      fields,
      userId,
    );

    // Clear user cache so next get() fetches fresh data
    if (user) {
      await NocoCache.del('root', `${CacheScope.USER}:${userId}`);
      await NocoCache.del('root', `${CacheScope.USER}:${user.email}`);
      if (user.email) {
        await NocoCache.del(
          'root',
          `${CacheScope.USER}:canonical:${normalizeEmail(user.email)}`,
        );
      }
    }
  }

  async setup(userId: string, password: string, req: NcRequest) {
    const user = await User.get(userId);
    if (!user) NcError.userNotFound(userId);

    if (user.totp_enabled) {
      NcError.badRequest('Two-factor authentication is already enabled');
    }

    // Identity re-proof. Branches on whether the account is local-password,
    // Cognito-native, or Cognito-federated. The `cognito_identity_type` tag
    // on `user.meta` is written by the Cognito strategy on every sign-in
    // (see CognitoStrategy.persistCognitoIdentityTag).
    const cognitoIdentity = this.getCognitoIdentity(user);

    if (user.password) {
      // Local password account — bcrypt re-confirm.
      const valid = await bcrypt.compare(password ?? '', user.password);
      if (!valid) {
        NcError.badRequest('Incorrect password');
      }
    } else if (cognitoIdentity?.type === 'federated') {
      // Google / SAML / etc. We can't password-verify against Cognito
      // for these users (the password lives at their IdP), and the
      // current PR scope is "native Cognito only" — point them at
      // their IdP. The card is still shown on the FE with a disabled
      // toggle + tooltip.
      NcError.forbidden(
        'Two-factor authentication for federated sign-in accounts must be configured at your identity provider.',
      );
    } else if (cognitoIdentity?.type === 'native') {
      // Native Cognito (email/password) — re-verify the supplied
      // password against the Cognito User Pool via InitiateAuth.
      await this.verifyCognitoPassword(user.email, password ?? '');
    }
    // No-op branch: no local password AND no Cognito tag = legacy SSO
    // (OIDC/SAML provisioned without a password). Session JWT remains
    // the proof; verifySetup still gates `totp_enabled` on a fresh
    // TOTP submission.

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: 'NocoDB',
      label: user.email,
      secret,
    });
    const qrUrl = await QRCode.toDataURL(otpauthUrl);

    const backupCodes = generateBackupCodes();

    // Store secret (encrypted) and backup codes (hashed) — not yet enabled
    const hashedCodes = await this.hashBackupCodes(backupCodes);
    await this.updateMfaFields(userId, {
      totp_secret: this.encryptSecret(secret),
      totp_backup_codes: JSON.stringify(hashedCodes),
    });

    this.appHooksService.emit(AppEvents.USER_MFA_SETUP, {
      user: user as any as UserType,
      req,
    });

    return {
      secret,
      qrUrl,
      backupCodes,
    };
  }

  async verifySetup(userId: string, code: string, req: NcRequest) {
    const user = await User.get(userId);
    if (!user) NcError.userNotFound(userId);

    if (user.totp_enabled) {
      NcError.badRequest('Two-factor authentication is already enabled');
    }

    if (!user.totp_secret) {
      NcError.badRequest('Please initiate 2FA setup first');
    }

    const isValid = await this.verifyTotp(
      this.decryptSecret(user.totp_secret),
      code,
    );

    if (!isValid) {
      NcError.badRequest('Invalid verification code');
    }

    // Enable 2FA
    await this.updateMfaFields(userId, {
      totp_enabled: true,
    });

    // Rotate token_version to invalidate all existing sessions
    // Forces re-login so all sessions must authenticate with MFA
    await User.update(userId, {
      token_version: randomTokenString(),
    });

    this.appHooksService.emit(AppEvents.USER_MFA_ENABLED, {
      user: user as any as UserType,
      req,
    });

    return { msg: 'Two-factor authentication has been enabled' };
  }

  async disable(userId: string, password: string | undefined, req: NcRequest) {
    const user = await User.get(userId);
    if (!user) NcError.userNotFound(userId);

    if (!user.totp_enabled) {
      NcError.badRequest('Two-factor authentication is not enabled');
    }

    if (user.password) {
      // User has a password (non-SSO) — require password re-confirmation
      if (!password) {
        NcError.badRequest('Password is required');
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        NcError.badRequest('Incorrect password');
      }
    }

    // Disable 2FA and clear secrets
    await this.updateMfaFields(userId, {
      totp_enabled: false,
      totp_secret: null,
      totp_backup_codes: null,
    });

    // Rotate token_version to invalidate all existing sessions
    await User.update(userId, {
      token_version: randomTokenString(),
    });

    this.appHooksService.emit(AppEvents.USER_MFA_DISABLED, {
      user: user as any as UserType,
      req,
    });

    return { msg: 'Two-factor authentication has been disabled' };
  }

  async status(userId: string) {
    const user = await User.get(userId);
    if (!user) NcError.userNotFound(userId);

    const cognitoIdentity = this.getCognitoIdentity(user);

    // `eligible` is the single switch the FE flips the toggle on. It's
    // false only for federated Cognito users today; everyone else (local
    // password, Cognito-native, legacy SSO without password) can enrol.
    const eligible = cognitoIdentity?.type !== 'federated';

    return {
      enabled: !!user.totp_enabled,
      hasPassword: !!user.password,
      eligible,
      ...(eligible
        ? {}
        : {
            ineligibleReason: 'federated' as const,
            // E.g. 'Google' — surfaced in the tooltip so the user knows
            // where to go (their IdP) to configure MFA.
            federationProvider: cognitoIdentity?.provider ?? null,
          }),
    };
  }

  async verifySignin(twoFactorToken: string, code: string, req: NcRequest) {
    const config = Noco.getConfig();

    let payload: {
      id: string;
      email: string;
      purpose: string;
      redirect?: string;
      extra?: Record<string, any>;
    };
    try {
      payload = jwt.verify(twoFactorToken, config.auth.jwt.secret) as any;
    } catch {
      return NcError.badRequest('Invalid or expired two-factor token');
    }

    if (payload.purpose !== 'mfa') {
      NcError.badRequest('Invalid token purpose');
    }

    // Check brute-force lockout
    await this.checkMfaLockout(payload.id);

    const user = await User.get(payload.id);
    if (!user) NcError.userNotFound(payload.id);

    if (!user.totp_enabled || !user.totp_secret) {
      NcError.badRequest('Two-factor authentication is not configured');
    }

    const method = await this.verifyCode(
      this.decryptSecret(user.totp_secret),
      code,
      user,
    );
    if (!method) {
      await this.incrementMfaFailure(payload.id);
      NcError.badRequest('Invalid verification code');
    }

    this.appHooksService.emit(AppEvents.USER_MFA_VERIFY, {
      user: user as any as UserType,
      method,
      req,
    });

    if (method === 'backup_code') {
      this.appHooksService.emit(AppEvents.USER_MFA_BACKUP_CODE_USED, {
        user: user as any as UserType,
        req,
      });
    }

    // Clear lockout on success
    await this.clearMfaLockout(payload.id);

    // Return the verified user; JWT generation happens in the controller
    // after setRefreshToken rotates token_version so the JWT carries the
    // new version (single-session enforcement). `redirect` is whatever
    // deep-link the original sign-in entry point captured for us; pass
    // it back so the controller / FE can re-navigate after cookie set.
    return {
      user,
      userId: user.id,
      redirect: payload.redirect,
      extra: payload.extra,
    };
  }

  /**
   * Check if user has 2FA enabled. If so, return a short-lived token
   * for the 2FA verification step. Returns null if 2FA is not enabled.
   *
   * `redirect` (the URL the user was originally heading to) and `extra`
   * (sign-in-flow-specific payload like `continueAfterSignIn`) are
   * embedded in the token so the post-verify response can hand them
   * back to the FE without server-side session state.
   */
  async getTwoFactorTokenIfEnabled(
    userId: string,
    opts?: { redirect?: string; extra?: Record<string, any> },
  ): Promise<string | null> {
    const user = await User.get(userId);
    if (!user?.totp_enabled) return null;

    return generateTwoFactorToken(
      { id: user.id, email: user.email },
      { redirect: opts?.redirect, extra: opts?.extra },
    );
  }

  private async verifyTotp(secret: string, token: string): Promise<boolean> {
    try {
      const result = verifySync({ token, secret });
      return result.valid;
    } catch {
      // verifySync throws on non-6-digit tokens — treat as invalid
      return false;
    }
  }

  private async verifyCode(
    secret: string,
    code: string,
    user: User,
  ): Promise<'totp' | 'backup_code' | null> {
    // First try TOTP verification
    const isValidTotp = await this.verifyTotp(secret, code);

    if (isValidTotp) return 'totp';

    // Try backup code
    if (await this.consumeBackupCode(user, code)) return 'backup_code';

    return null;
  }

  private async consumeBackupCode(user: User, code: string): Promise<boolean> {
    if (!user.totp_backup_codes) return false;

    let backupCodes: string[];
    try {
      backupCodes = JSON.parse(user.totp_backup_codes);
    } catch {
      return false;
    }

    if (!backupCodes.length) return false;

    const normalizedCode = normalizeCode(code);

    // Try bcrypt comparison (hashed codes)
    for (let i = 0; i < backupCodes.length; i++) {
      try {
        const match = await bcrypt.compare(normalizedCode, backupCodes[i]);
        if (match) {
          backupCodes.splice(i, 1);
          await this.updateMfaFields(user.id, {
            totp_backup_codes: JSON.stringify(backupCodes),
          });
          return true;
        }
      } catch {
        // Not a bcrypt hash — fall through to plaintext check below
      }
    }

    // Fallback: plaintext comparison (pre-hashing data)
    const idx = backupCodes.findIndex(
      (c) => normalizeCode(c) === normalizedCode,
    );

    if (idx === -1) return false;

    // Consume the matched code and re-hash remaining codes for gradual migration
    backupCodes.splice(idx, 1);
    const hashedRemaining = await this.hashBackupCodes(backupCodes);
    await this.updateMfaFields(user.id, {
      totp_backup_codes: JSON.stringify(hashedRemaining),
    });

    return true;
  }

  private async hashBackupCodes(codes: string[]): Promise<string[]> {
    const hashes: string[] = [];
    for (const code of codes) {
      const normalized = normalizeCode(code);
      const hash = await bcrypt.hash(normalized, 10);
      hashes.push(hash);
    }
    return hashes;
  }

  private encryptSecret(secret: string): string {
    const wrapper = { secret };
    const encrypted = encryptPropIfRequired({
      data: wrapper,
      prop: 'secret',
    });
    return encrypted ?? secret;
  }

  private decryptSecret(encrypted: string): string {
    try {
      const wrapper = { secret: encrypted };
      const decrypted = decryptPropIfRequired({
        data: wrapper,
        prop: 'secret',
      });
      return typeof decrypted === 'string' ? decrypted : encrypted;
    } catch {
      // Fallback: value is likely plaintext (pre-encryption data)
      return encrypted;
    }
  }

  async regenerateBackupCodes(userId: string, code: string, _req: NcRequest) {
    const user = await User.get(userId);
    if (!user) NcError.userNotFound(userId);

    if (!user.totp_enabled) {
      NcError.badRequest('Two-factor authentication is not enabled');
    }

    // Verify current TOTP code before regenerating
    const isValid = await this.verifyTotp(
      this.decryptSecret(user.totp_secret),
      code,
    );

    if (!isValid) {
      NcError.badRequest('Invalid verification code');
    }

    const backupCodes = generateBackupCodes();
    const hashedCodes = await this.hashBackupCodes(backupCodes);

    await this.updateMfaFields(userId, {
      totp_backup_codes: JSON.stringify(hashedCodes),
    });

    // Rotate token_version to invalidate all existing sessions
    await User.update(userId, {
      token_version: randomTokenString(),
    });

    return { backupCodes };
  }

  /**
   * Read the Cognito identity tag stamped onto `user.meta` by
   * `CognitoStrategy.persistCognitoIdentityTag` on each sign-in.
   *
   * Returns `null` for legacy users predating the tag and for non-Cognito
   * accounts — callers should treat that as "no Cognito constraint
   * applies" and fall back to the existing local-password / SSO branches.
   */
  private getCognitoIdentity(user: {
    meta?: any;
  }): { type: 'native' | 'federated'; provider?: string | null } | null {
    if (!user?.meta) return null;
    const meta =
      typeof user.meta === 'string'
        ? safeJsonParse(user.meta)
        : user.meta;
    if (!meta?.cognito_identity_type) return null;
    return {
      type: meta.cognito_identity_type,
      provider: meta.cognito_federation_provider ?? null,
    };
  }

  /**
   * Re-verify a Cognito-native user's password by calling Cognito's
   * `AdminInitiateAuth` with the `ADMIN_USER_PASSWORD_AUTH` flow.
   *
   * Used as the identity-proof step before flipping `totp_enabled` for
   * users who signed up via the Cognito User Pool directly (no NocoDB-
   * side bcrypt hash to compare against).
   *
   * Why the admin flow:
   *   - `USER_PASSWORD_AUTH` (client-side) is deliberately disabled on
   *     the production User Pool — that flow is for SPAs and ships the
   *     plaintext password from a browser.
   *   - `ADMIN_USER_PASSWORD_AUTH` runs from a server with AWS creds,
   *     which is exactly our shape. The same flow is already used by
   *     `UsersService.changePassword` against the same pool, so we
   *     know it's enabled on the App Client.
   *
   * We mirror that service's pattern: `ListUsers` to find the native
   * account record (filtering out `EXTERNAL_PROVIDER` shadows that
   * federated sign-ins create), then `AdminInitiateAuth` keyed on the
   * resolved username. A native-tagged user that has no native record
   * is a data inconsistency — log and reject.
   *
   * Throws `NcError.badRequest('Incorrect password')` on a bad password.
   * Throws `NcError.internalServerError` if Cognito isn't configured.
   */
  private async verifyCognitoPassword(
    email: string,
    password: string,
  ): Promise<void> {
    if (!password) {
      NcError.badRequest('Password is required');
    }

    const userPoolId = process.env.NC_COGNITO_AWS_USER_POOLS_ID;
    const clientId = process.env.NC_COGNITO_AWS_USER_POOLS_WEB_CLIENT_ID;
    const region = process.env.NC_COGNITO_AWS_COGNITO_REGION;

    if (!userPoolId || !clientId || !region) {
      this.logger.error(
        'verifyCognitoPassword called without Cognito config — user is tagged native but env vars are missing',
      );
      NcError.internalServerError(
        'Two-factor setup is temporarily unavailable. Please try again later.',
      );
    }

    const client = new CognitoIdentityProviderClient({ region });

    let username: string;
    try {
      const { Users: candidates } = await client.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `email = "${email}"`,
        }),
      );

      // Federated sign-ins create a shadow record with
      // UserStatus === 'EXTERNAL_PROVIDER' — skip those; we want the
      // native row that has a real password attached.
      const nativeAccount = (candidates ?? []).find(
        (u) => u.UserStatus !== 'EXTERNAL_PROVIDER',
      );

      if (!nativeAccount?.Username) {
        this.logger.error(
          `verifyCognitoPassword: native-tagged user ${email} has no native Cognito record`,
        );
        NcError.badRequest('Could not verify password. Please try again.');
      }

      username = nativeAccount.Username;
    } catch (e: any) {
      this.logger.error(
        `verifyCognitoPassword ListUsers failed for ${email}: ${e?.name ?? 'unknown'} ${e?.message ?? ''}`,
        e?.stack,
      );
      NcError.badRequest('Could not verify password. Please try again.');
    }

    try {
      await client.send(
        new AdminInitiateAuthCommand({
          UserPoolId: userPoolId,
          ClientId: clientId,
          AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
          },
        }),
      );
      // Successful response (`AuthenticationResult` populated) is the
      // proof — we don't keep the tokens.
    } catch (e: any) {
      // Cognito returns one of: NotAuthorizedException (bad password),
      // UserNotFoundException, PasswordResetRequiredException,
      // UserNotConfirmedException, TooManyRequestsException, etc.
      // Surface a generic "incorrect password" for the bad-password case;
      // anything else is a server-side problem we don't want to leak.
      if (e?.name === 'NotAuthorizedException') {
        NcError.badRequest('Incorrect password');
      }
      this.logger.error(
        `verifyCognitoPassword AdminInitiateAuth failed for ${email}: ${e?.name ?? 'unknown'} ${e?.message ?? ''}`,
        e?.stack,
      );
      NcError.badRequest('Could not verify password. Please try again.');
    }
  }
}

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}
