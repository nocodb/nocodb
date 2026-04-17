import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { AppEvents } from 'nocodb-sdk';
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
import { genJwt } from '~/services/users/helpers';
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
  secret?: string,
): string {
  const jwtSecret = secret ?? Noco.getConfig().auth.jwt.secret;
  return jwt.sign(
    { id: user.id, email: user.email, purpose: 'mfa' },
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

    // Require password re-confirmation for security
    if (!user.password) {
      NcError.badRequest(
        'Password verification is not available for this account',
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      NcError.badRequest('Incorrect password');
    }

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

    this.appHooksService.emit(AppEvents.USER_MFA_ENABLED, {
      user: user as any as UserType,
      req,
    });

    return { msg: 'Two-factor authentication has been enabled' };
  }

  async disable(userId: string, password: string, req: NcRequest) {
    const user = await User.get(userId);
    if (!user) NcError.userNotFound(userId);

    if (!user.totp_enabled) {
      NcError.badRequest('Two-factor authentication is not enabled');
    }

    if (!password) {
      NcError.badRequest('Password is required');
    }

    // Require password re-confirmation for security
    if (!user.password) {
      NcError.badRequest(
        'Password verification is not available for this account',
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      NcError.badRequest('Incorrect password');
    }

    // Disable 2FA and clear secrets
    await this.updateMfaFields(userId, {
      totp_enabled: false,
      totp_secret: null,
      totp_backup_codes: null,
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

    return { enabled: !!user.totp_enabled };
  }

  async verifySignin(twoFactorToken: string, code: string, req: NcRequest) {
    const config = Noco.getConfig();

    let payload: { id: string; email: string; purpose: string };
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

    // Generate full JWT
    return {
      token: genJwt(user as any, config),
      userId: user.id,
    };
  }

  /**
   * Check if user has 2FA enabled. If so, return a short-lived token
   * for the 2FA verification step. Returns null if 2FA is not enabled.
   */
  async getTwoFactorTokenIfEnabled(userId: string): Promise<string | null> {
    const user = await User.get(userId);
    if (!user?.totp_enabled) return null;

    return generateTwoFactorToken({ id: user.id, email: user.email });
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

    return { backupCodes };
  }
}
