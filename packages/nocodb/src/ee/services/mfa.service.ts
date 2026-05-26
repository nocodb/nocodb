import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { AppEvents } from 'nocodb-sdk';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
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
import { isCloud } from '~/utils';
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
    userExtra?: Record<string, any>;
  },
): string {
  const jwtSecret = opts?.secret ?? Noco.getConfig().auth.jwt.secret;
  // `redirect` and `extra` carry post-verify hand-back state for the FE
  // (e.g. `continueAfterSignIn` from the OIDC state replay).
  // `userExtra` carries the per-session identity payload the sign-in
  // strategy stamped on `req.user.extra` — `cognito_identity_type`
  // etc. — so the post-verify controller can re-attach it to the
  // refresh-token meta and the final JWT. Without this, the
  // multi-device per-session signal we just wired up would be lost
  // for 2FA-enabled Cognito accounts.
  //
  // Sign-only, no encryption. None of these fields should be treated
  // as trusted on the FE.
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      purpose: 'mfa',
      ...(opts?.redirect ? { redirect: opts.redirect } : {}),
      ...(opts?.extra ? { extra: opts.extra } : {}),
      ...(opts?.userExtra ? { userExtra: opts.userExtra } : {}),
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

    // Per-session sign-in classification. All reads come from
    // `req.user.extra`, which is populated by JwtStrategy from the JWT
    // payload — itself set by the sign-in strategy and carried across
    // refresh-token regeneration via `userRefreshToken.meta`. This is
    // intentionally NOT `user.meta` (which reflects the *last* Cognito
    // sign-in across all sessions and would be wrong on multi-device).
    const session = this.getSessionIdentity(req, user);

    if (user.password) {
      // Local password account — bcrypt re-confirm.
      const valid = await bcrypt.compare(password ?? '', user.password);
      if (!valid) {
        NcError.badRequest('Incorrect password');
      }
    } else if (session.isSso) {
      // SAML / OIDC sign-in. IdP owns this user's MFA posture.
      NcError.forbidden(
        'Two-factor authentication for SSO sign-in accounts must be configured at your identity provider.',
      );
    } else if (session.cognitoType === 'federated') {
      // Cognito federated (Google etc.). Same reasoning — IdP owns MFA.
      // Dual-identity users (federated + native on same email) must
      // switch to the email/password sign-in to enrol.
      NcError.forbidden(
        'Two-factor authentication for federated sign-in accounts must be configured at your identity provider.',
      );
    } else if (session.cognitoType === 'native') {
      // Cognito email/password — re-verify via InitiateAuth.
      await this.verifyCognitoPassword(user.email, password ?? '');
    } else if (session.isLegacyCloudSession) {
      // Cloud session minted before per-session identity stamping
      // shipped — we can't classify it safely, so force a re-sign-in
      // to populate the tag rather than fall through to the legacy
      // session-JWT-as-proof branch.
      NcError.forbidden(
        'Two-factor authentication is only available for accounts that sign in with email and password. Please sign out and sign in again to refresh your session.',
      );
    } else if (!user.password) {
      // Belt-and-braces guard. By this point we've ruled out:
      //   - local password (handled above)
      //   - SSO session (forbidden above)
      //   - Cognito federated session (forbidden above)
      //   - Cognito native session (handled above)
      //   - legacy Cloud session (forbidden above)
      // What's left is an authenticated session with no local password
      // and no per-session identity — pre-PR this was treated as
      // "legacy SSO" with session-JWT-as-proof, but that's a real
      // regression: an XSS or stolen cookie on such a session can enrol
      // 2FA with no reproof. Refuse the enrolment and tell the user to
      // sign in via a password-backed flow.
      NcError.forbidden(
        'Two-factor authentication requires signing in with email and password. Please sign in with your password to enable.',
      );
    }
    // Reaching here means user.password is set AND we passed the bcrypt
    // re-confirm — proceed with enrolment. verifySetup gates the actual
    // `totp_enabled` flip on a fresh TOTP submission.

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

    // Reproof matrix MUST be symmetric with `setup` — otherwise a
    // session-cookie attacker on a Cognito-native or SSO account could
    // flip 2FA off without supplying the password.
    const session = this.getSessionIdentity(req, user);

    if (session.isSso) {
      NcError.forbidden(
        'Disabling two-factor authentication is not allowed from an SSO session. Please sign in with your password to disable.',
      );
    }

    if (session.cognitoType === 'federated') {
      NcError.forbidden(
        'Disabling two-factor authentication is not allowed from a federated sign-in session. Please sign in with your password to disable.',
      );
    }

    if (user.password) {
      // Local password — bcrypt re-confirm.
      if (!password) {
        NcError.badRequest('Password is required');
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        NcError.badRequest('Incorrect password');
      }
    } else if (session.cognitoType === 'native') {
      // Cognito email/password account — re-verify against Cognito.
      // Without this branch, a stolen session cookie on a Cognito-native
      // account could disable 2FA in a single POST.
      await this.verifyCognitoPassword(user.email, password ?? '');
    } else if (session.isLegacyCloudSession) {
      // Same reasoning as `setup` — can't classify, force re-sign-in.
      NcError.forbidden(
        'Two-factor authentication is only available for accounts that sign in with email and password. Please sign out and sign in again to refresh your session.',
      );
    } else if (isCloud) {
      // Belt-and-braces: on Cloud, every active session post-this-PR
      // either has `user.password`, hits the SSO/federated guards
      // above, has `cognito_identity_type === 'native'`, or is flagged
      // legacy. Anything else is an unexpected state — refuse to
      // disable without a proof rather than silently falling through.
      NcError.forbidden(
        'Two-factor authentication cannot be disabled from this session. Please sign in via your password to disable.',
      );
    }
    // On on-prem, an authenticated user with no local password and no
    // Cognito tag is legitimate legacy-SSO (e.g. SAML provisioning
    // without a NocoDB-side hash). Pre-PR behaviour relied on the
    // session JWT alone; preserve that fall-through here so existing
    // on-prem enrolments stay disable-able.

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

  async status(userId: string, req?: NcRequest) {
    const user = await User.get(userId);
    if (!user) NcError.userNotFound(userId);

    const session = this.getSessionIdentity(req, user);

    // `eligible` is the single switch the FE flips the toggle on.
    // Blocked for sessions we can't re-prove via password — SSO sessions
    // and Cognito-federated sessions. Local-password and Cognito-native
    // pass through. Dual-identity Cognito users have to switch to the
    // email/password sign-in to enrol.
    //
    // 'legacy_session' covers Cloud sessions minted pre-this-PR whose
    // JWT lacks the per-session identity tag. The FE tooltip prompts
    // the user to sign out + sign in to pick up the tag; once they do,
    // they re-enter the normal classification flow.
    let ineligibleReason: 'sso' | 'federated' | 'legacy_session' | null = null;
    if (session.isSso) {
      ineligibleReason = 'sso';
    } else if (session.cognitoType === 'federated') {
      ineligibleReason = 'federated';
    } else if (session.isLegacyCloudSession) {
      ineligibleReason = 'legacy_session';
    }

    const eligible = ineligibleReason === null;

    return {
      enabled: !!user.totp_enabled,
      hasPassword: !!user.password,
      eligible,
      ...(eligible
        ? {}
        : {
            ineligibleReason,
            // E.g. 'Google' — surfaced in the tooltip so the user knows
            // where to go (their IdP) to configure MFA. Only meaningful
            // for the 'federated' reason.
            ...(ineligibleReason === 'federated'
              ? { federationProvider: session.federationProvider }
              : {}),
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
      userExtra?: Record<string, any>;
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
      // Per-session identity carried over from the original sign-in's
      // `req.user.extra` — the post-verify controller re-attaches this
      // so refresh-token meta + the freshly-minted JWT keep it.
      userExtra: payload.userExtra,
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
    opts?: {
      redirect?: string;
      extra?: Record<string, any>;
      // The per-session payload the sign-in strategy stamped on
      // `req.user.extra` — propagated through the 2FA token so the
      // post-verify controller can re-attach it to the refresh-token
      // meta. Must include `cognito_identity_type` for Cognito
      // sign-ins so subsequent JWTs (including refresh regen) keep
      // the per-session identity tag the mfa gating relies on.
      userExtra?: Record<string, any>;
    },
  ): Promise<string | null> {
    const user = await User.get(userId);
    if (!user?.totp_enabled) return null;

    // Cognito-federated bypass — the IdP (Google etc.) owns this
    // user's MFA posture. Symmetric with disable() and
    // workspace-level enforcement; SAML / OIDC controllers don't
    // call this function at all so they bypass implicitly.
    if (opts?.userExtra?.cognito_identity_type === 'federated') return null;

    return generateTwoFactorToken(
      { id: user.id, email: user.email },
      {
        redirect: opts?.redirect,
        extra: opts?.extra,
        userExtra: opts?.userExtra,
      },
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
   * Classify the current session so MFA gating (setup / disable /
   * status / signin-challenge) can apply per-session rules.
   *
   * Reads from `req.user.extra` — the per-session payload populated by
   * `JwtStrategy.validate` from the JWT's whitelisted fields. The
   * underlying source is whatever the sign-in strategy put on
   * `req.user.extra` at sign-in time, which `setRefreshToken`
   * persists into `userRefreshToken.meta` and refresh-token regen
   * spreads back into the new JWT. Therefore the value reflects the
   * *current session*, not the last sign-in across all devices.
   *
   * Falls back to `user.meta.cognito_identity_type` only when the
   * per-session field is absent — covers sessions issued before this
   * field was added to the JWT whitelist. New sign-ins always set the
   * per-session field so the fallback fades organically.
   *
   * `req` is optional so callers that don't have a request (e.g.
   * background hooks) can still consult; in that case we only get the
   * user-meta view.
   */
  private getSessionIdentity(
    req: NcRequest | undefined,
    user: { meta?: any; password?: string },
  ): {
    isSso: boolean;
    cognitoType: 'native' | 'federated' | null;
    federationProvider: string | null;
    /**
     * Legacy session on Cloud: signed in before this PR landed, so the
     * JWT (and the row in `nc_user_refresh_tokens.meta`) lacks the
     * per-session Cognito identity tag. We can't reliably classify
     * them — `user.meta` is multi-device-stale and may be empty
     * altogether. Only meaningful on Cloud, where every active sign-in
     * post-this-PR carries the tag; on on-prem the same shape is
     * legitimate legacy-SSO (no password, no Cognito) and should fall
     * through to "session JWT is the proof".
     */
    isLegacyCloudSession: boolean;
  } {
    const extra = (req as any)?.user?.extra ?? {};
    const isSso = !!extra.sso_client_id;

    let cognitoType: 'native' | 'federated' | null = null;
    let federationProvider: string | null = null;
    let resolvedFromPerSession = false;

    if (extra.cognito_identity_type) {
      cognitoType = extra.cognito_identity_type;
      federationProvider = extra.cognito_federation_provider ?? null;
      resolvedFromPerSession = true;
    } else {
      // Pre-PR fallback. Stale for multi-session users but better
      // than treating them as un-classifiable.
      const meta =
        typeof user?.meta === 'string'
          ? safeJsonParse(user.meta)
          : user?.meta ?? {};
      if (meta?.cognito_identity_type) {
        cognitoType = meta.cognito_identity_type;
        federationProvider = meta.cognito_federation_provider ?? null;
      }
    }

    // Cloud-only legacy detection. The user has no local password, no
    // SSO marker, AND the per-session Cognito tag is missing (could be
    // backed by a stale user.meta read too — both branches above run
    // before this check). Surface as a distinct ineligibility reason
    // so the FE can ask the user to re-sign-in rather than silently
    // letting the legacy-SSO fallthrough run on Cloud (where it
    // shouldn't apply post-this-PR).
    const isLegacyCloudSession =
      isCloud &&
      !user?.password &&
      !isSso &&
      cognitoType === null &&
      !resolvedFromPerSession;

    return {
      isSso,
      cognitoType,
      federationProvider,
      isLegacyCloudSession,
    };
  }

  /**
   * Re-verify a Cognito-native user's password by calling Cognito's
   * `InitiateAuth` with the `USER_PASSWORD_AUTH` flow.
   *
   * Used as the identity-proof step before flipping `totp_enabled` for
   * users who signed up via the Cognito User Pool directly (no NocoDB-
   * side bcrypt hash to compare against).
   *
   * Why the client-side flow (not the admin one):
   *   - `InitiateAuth` is an unauthenticated Cognito API — it only needs
   *     the App Client id (already public; the FE bundles it for Amplify
   *     to consume). The BE doesn't have to hold AWS IAM creds.
   *   - `AdminInitiateAuth` would be cleaner posture-wise but requires
   *     the BE process to have AWS creds available, which preview /
   *     self-hosted deployments don't always get (the SDK throws
   *     `CredentialsProviderError` when the provider chain finds none).
   *   - Cognito hashes the password server-side; the plaintext only
   *     crosses TLS-protected hops we already trust (browser → our BE
   *     → Cognito).
   *
   * Requires `ALLOW_USER_PASSWORD_AUTH` to be enabled on the App Client
   * (`NC_COGNITO_AWS_USER_POOLS_WEB_CLIENT_ID`). If it's disabled,
   * Cognito returns `InvalidParameterException: USER_PASSWORD_AUTH flow
   * not enabled for this client`.
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

    const clientId = process.env.NC_COGNITO_AWS_USER_POOLS_WEB_CLIENT_ID;
    const region = process.env.NC_COGNITO_AWS_COGNITO_REGION;

    if (!clientId || !region) {
      this.logger.error(
        'verifyCognitoPassword called without Cognito config — user is tagged native but env vars are missing',
      );
      NcError.internalServerError(
        'Two-factor setup is temporarily unavailable. Please try again later.',
      );
    }

    const client = new CognitoIdentityProviderClient({ region });
    try {
      await client.send(
        new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: clientId,
          AuthParameters: {
            USERNAME: email,
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
        `verifyCognitoPassword failed for ${email}: ${e?.name ?? 'unknown'} ${e?.message ?? ''}`,
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
