import axios from 'axios';
import { Logger } from '@nestjs/common';
import User from '~/models/User';
import Noco from '~/Noco';

const logger = new Logger('EmailValidation');

export interface EmailValidationResult {
  isValid: boolean;
  isDeliverable: boolean;
  isDisposable: boolean;
  isRole: boolean;
  score: number;
  reason?: string;
  state: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
}

export interface EmailValidationConfig {
  apiKey?: string;
  minScore?: number; // Minimum score to consider email valid (0-100)
  allowRisky?: boolean; // Whether to allow risky emails
  allowRole?: boolean; // Whether to allow role-based emails (info@, admin@, etc.)
  allowDisposable?: boolean; // Whether to allow disposable emails
}

/**
 * Email validation helper using Emailable API
 * @see https://emailable.com/api/
 */
export class EmailValidationHelper {
  private static config: EmailValidationConfig = {
    minScore: 70,
    allowRisky: true,
    allowRole: true,
    allowDisposable: false,
  };

  /**
   * Initialize email validation with configuration
   */
  static init(config: EmailValidationConfig) {
    this.config = { ...this.config, ...config };

    if (config.apiKey) {
      logger.log('Email validation enabled with Emailable API');
    }
  }

  /**
   * Check if email validation is enabled
   */
  static isEnabled(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Validate single email address using Emailable API with database caching
   */
  static async validateEmail(
    email: string,
    ncMeta = Noco.ncMeta,
  ): Promise<EmailValidationResult> {
    if (!this.isEnabled() || !this.config.apiKey) {
      return {
        isValid: true,
        isDeliverable: true,
        isDisposable: false,
        isRole: false,
        score: 100,
        state: 'deliverable',
        reason: 'Validation disabled',
      };
    }

    try {
      // First check database for cached result
      const user = await User.getByEmail(email, ncMeta);
      const cacheValidHours = 24; // Cache validation results for 24 hours

      if (user && user.email_validation) {
        const validation =
          typeof user.email_validation === 'string'
            ? JSON.parse(user.email_validation)
            : user.email_validation;

        if (validation.checkedAt) {
          const lastChecked = new Date(validation.checkedAt);
          const hoursSinceCheck =
            (Date.now() - lastChecked.getTime()) / (1000 * 60 * 60);

          if (
            hoursSinceCheck < cacheValidHours &&
            validation.status !== 'pending'
          ) {
            logger.debug(
              `Using cached validation result for ${email}: ${validation.status}`,
            );

            return {
              isValid:
                validation.status !== 'undeliverable' &&
                validation.status !== 'invalid',
              isDeliverable: validation.status === 'verified',
              isDisposable: validation.isDisposable || false,
              isRole: validation.isRole || false,
              score: validation.score || 0,
              state: this.mapStatusToState(validation.status),
              reason: 'Cached result',
            };
          }
        }
      }

      // Make API call if no cached result or cache is stale
      const response = await axios.get('https://api.emailable.com/v1/verify', {
        params: {
          api_key: this.config.apiKey,
          email: email,
        },
        timeout: 10000,
      });

      const data = response.data;

      const result: EmailValidationResult = {
        isValid: data.state !== 'undeliverable',
        isDeliverable: data.state === 'deliverable',
        isDisposable: data.disposable || false,
        isRole: data.role || false,
        score: data.score || 0,
        state: data.state || 'unknown',
        reason: data.reason,
      };

      // Cache the result in database if user exists
      if (user) {
        await this.cacheValidationResult(user.id, result, ncMeta);
      }

      logger.debug(`Email validation result for ${email}:`, result);
      return result;
    } catch (error) {
      logger.error(`Email validation failed for ${email}:`, error.message);

      // Fail gracefully - assume email is valid if API fails
      return {
        isValid: true,
        isDeliverable: true,
        isDisposable: false,
        isRole: false,
        score: 50,
        state: 'unknown',
        reason: `API Error: ${error.message}`,
      };
    }
  }

  /**
   * Cache validation result in database
   */
  private static async cacheValidationResult(
    userId: string,
    result: EmailValidationResult,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    try {
      const validationData = {
        status: this.mapStateToStatus(result.state),
        score: result.score,
        checkedAt: new Date().toISOString(),
        isDisposable: result.isDisposable,
        isRole: result.isRole,
      };

      await User.update(
        userId,
        {
          email_validation: JSON.stringify(validationData),
        },
        ncMeta,
      );

      logger.debug(`Cached validation result for user ${userId}`);
    } catch (error) {
      logger.error(
        `Failed to cache validation result for user ${userId}:`,
        error.message,
      );
    }
  }

  /**
   * Map Emailable state to our database status
   */
  private static mapStateToStatus(
    state: string,
  ): 'pending' | 'verified' | 'invalid' | 'undeliverable' | 'risky' {
    switch (state) {
      case 'deliverable':
        return 'verified';
      case 'undeliverable':
        return 'undeliverable';
      case 'risky':
        return 'risky';
      case 'unknown':
        return 'invalid';
      default:
        return 'pending';
    }
  }

  /**
   * Map our database status to Emailable-like state
   */
  private static mapStatusToState(
    status: string,
  ): 'deliverable' | 'undeliverable' | 'risky' | 'unknown' {
    switch (status) {
      case 'verified':
        return 'deliverable';
      case 'undeliverable':
        return 'undeliverable';
      case 'risky':
        return 'risky';
      case 'invalid':
        return 'unknown';
      default:
        return 'unknown';
    }
  }

  /**
   * Check if email should be blocked based on validation result and configuration
   */
  static shouldBlockEmail(result: EmailValidationResult): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    // Block undeliverable emails
    if (result.state === 'undeliverable') {
      return true;
    }

    // Block based on score threshold
    if (result.score < (this.config.minScore || 70)) {
      return true;
    }

    // Block risky emails if not allowed
    if (result.state === 'risky' && !this.config.allowRisky) {
      return true;
    }

    // Block disposable emails if not allowed
    if (result.isDisposable && !this.config.allowDisposable) {
      return true;
    }

    // Block role emails if not allowed
    if (result.isRole && !this.config.allowRole) {
      return true;
    }

    return false;
  }

  /**
   * Validate email and return whether it should be blocked
   */
  static async shouldSkipEmail(
    email: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const result = await this.validateEmail(email, ncMeta);
      const shouldBlock = this.shouldBlockEmail(result);

      if (shouldBlock) {
        logger.warn(
          `Email blocked: ${email} - ${result.reason || result.state} (score: ${
            result.score
          })`,
        );
      }

      return shouldBlock;
    } catch (error) {
      logger.error(
        `Email validation check failed for ${email}:`,
        error.message,
      );
      return false; // Don't block on error
    }
  }

  /**
   * Validate multiple emails in batch with database caching
   * Note: Emailable API supports batch operations for better performance
   */
  static async validateEmails(
    emails: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<Map<string, EmailValidationResult>> {
    const results = new Map<string, EmailValidationResult>();

    if (!this.isEnabled() || !emails.length) {
      // Return all as valid if disabled
      emails.forEach((email) => {
        results.set(email, {
          isValid: true,
          isDeliverable: true,
          isDisposable: false,
          isRole: false,
          score: 100,
          state: 'deliverable',
          reason: 'Validation disabled',
        });
      });
      return results;
    }

    // Process sequentially with small delays and caching
    for (const email of emails) {
      const result = await this.validateEmail(email, ncMeta);
      results.set(email, result);

      // Small delay to respect rate limits
      if (emails.indexOf(email) < emails.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Get current configuration
   */
  static getConfig(): EmailValidationConfig {
    return { ...this.config };
  }
}

/**
 * Initialize email validation from environment variables
 */
export function initEmailValidationFromEnv(): void {
  const apiKey = process.env.NC_EMAIL_VALIDATION_API_KEY;

  // Only initialize if API key is provided
  if (!apiKey) {
    logger.debug('Email validation disabled - no API key provided');
    return;
  }

  const config: EmailValidationConfig = {
    apiKey,
    minScore: process.env.NC_EMAIL_VALIDATION_MIN_SCORE
      ? parseInt(process.env.NC_EMAIL_VALIDATION_MIN_SCORE, 10)
      : 70,
    allowRisky: process.env.NC_EMAIL_VALIDATION_ALLOW_RISKY !== 'false',
    allowRole: process.env.NC_EMAIL_VALIDATION_ALLOW_ROLE !== 'false',
    allowDisposable:
      process.env.NC_EMAIL_VALIDATION_ALLOW_DISPOSABLE === 'true',
  };

  EmailValidationHelper.init(config);
}
