import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import * as jwt from 'jsonwebtoken';
import { AppEvents } from 'nocodb-sdk';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { User } from '~/models';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import { normalizeEmail } from '~/utils/emailUtils';
import { genJwt } from '~/services/users/helpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

// otplib v13 is ESM-only — use dynamic import
let _otplib: typeof import('otplib') | null = null;
async function getOtplib() {
  if (!_otplib) {
    _otplib = await import('otplib');
  }
  return _otplib;
}

@Injectable()
export class MfaService {
  protected logger = new Logger(MfaService.name);

  constructor(protected appHooksService: AppHooksService) {}

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

    const otplib = await getOtplib();
    const secret = otplib.generateSecret();
    const otpauthUrl = otplib.generateURI({
      issuer: 'NocoDB',
      label: user.email,
      secret,
    });
    const qrUrl = await QRCode.toDataURL(otpauthUrl);

    const backupCodes = this.generateBackupCodes();

    // Store secret and backup codes temporarily (not yet enabled)
    await this.updateMfaFields(userId, {
      totp_secret: secret,
      totp_backup_codes: JSON.stringify(backupCodes),
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

    const isValid = await this.verifyTotp(user.totp_secret, code);

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

  async disable(userId: string, code: string, req: NcRequest) {
    const user = await User.get(userId);
    if (!user) NcError.userNotFound(userId);

    if (!user.totp_enabled) {
      NcError.badRequest('Two-factor authentication is not enabled');
    }

    const method = await this.verifyCode(user.totp_secret, code, user);
    if (!method) {
      NcError.badRequest('Invalid verification code');
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

    const user = await User.get(payload.id);
    if (!user) NcError.userNotFound(payload.id);

    if (!user.totp_enabled || !user.totp_secret) {
      NcError.badRequest('Two-factor authentication is not configured');
    }

    const method = await this.verifyCode(user.totp_secret, code, user);
    if (!method) {
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

    // Generate full JWT
    return {
      token: genJwt(user as any, config),
    };
  }

  /**
   * Check if user has 2FA enabled. If so, return a short-lived token
   * for the 2FA verification step. Returns null if 2FA is not enabled.
   */
  async getTwoFactorTokenIfEnabled(userId: string): Promise<string | null> {
    const user = await User.get(userId);
    if (!user?.totp_enabled) return null;

    return this.generateTwoFactorToken({ id: user.id, email: user.email });
  }

  private generateTwoFactorToken(user: { id: string; email: string }) {
    const config = Noco.getConfig();
    return jwt.sign(
      { id: user.id, email: user.email, purpose: 'mfa' },
      config.auth.jwt.secret,
      { expiresIn: '5m' },
    );
  }

  private async verifyTotp(secret: string, token: string): Promise<boolean> {
    try {
      const otplib = await getOtplib();
      const result = otplib.verifySync({ token, secret });
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
    if (this.consumeBackupCode(user, code)) return 'backup_code';

    return null;
  }

  private consumeBackupCode(user: User, code: string): boolean {
    if (!user.totp_backup_codes) return false;

    let backupCodes: string[];
    try {
      backupCodes = JSON.parse(user.totp_backup_codes);
    } catch {
      return false;
    }

    const normalizedCode = code.replace(/[-\s]/g, '').toLowerCase();
    const idx = backupCodes.findIndex(
      (c) => c.replace(/[-\s]/g, '').toLowerCase() === normalizedCode,
    );

    if (idx === -1) return false;

    // Remove used backup code
    backupCodes.splice(idx, 1);

    // Update asynchronously — don't block verification
    this.updateMfaFields(user.id, {
      totp_backup_codes: JSON.stringify(backupCodes),
    }).catch((e) => {
      this.logger.error('Failed to consume backup code', e.stack);
    });

    return true;
  }

  private generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex');
      // Format as xxxx-xxxx for readability
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  async regenerateBackupCodes(userId: string, code: string, _req: NcRequest) {
    const user = await User.get(userId);
    if (!user) NcError.userNotFound(userId);

    if (!user.totp_enabled) {
      NcError.badRequest('Two-factor authentication is not enabled');
    }

    // Verify current TOTP code before regenerating
    const isValid = await this.verifyTotp(user.totp_secret, code);

    if (!isValid) {
      NcError.badRequest('Invalid verification code');
    }

    const backupCodes = this.generateBackupCodes();

    await this.updateMfaFields(userId, {
      totp_backup_codes: JSON.stringify(backupCodes),
    });

    return { backupCodes };
  }
}
