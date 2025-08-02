import axios from 'axios';
import { Logger } from '@nestjs/common';
import type { IEmailAdapter } from '~/types/nc-plugin';
import type { XcEmail } from '~/interface/IEmailAdapter';
import User from '~/models/User';
import Noco from '~/Noco';
import { parseMetaProp } from '~/utils/modelUtils';

const logger = new Logger('EmailValidation');

export interface EmailValidationResult {
  isValid: boolean;
  isDeliverable: boolean;
  isDisposable: boolean;
  isRole: boolean;
  score: number;
  reason?: string;
  state: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
  // Additional Emailable API fields
  acceptAll?: boolean;
  free?: boolean;
  didYouMean?: string;
  mailboxFull?: boolean;
  noReply?: boolean;
}

export interface EmailValidationConfig {
  apiKey?: string;
  minScore?: number; // Minimum score to consider email valid (0-100)
  allowRisky?: boolean; // Whether to allow risky emails
  allowRole?: boolean; // Whether to allow role-based emails (info@, admin@, etc.)
  allowDisposable?: boolean; // Whether to allow disposable emails
}

/**
 * Generic email validation wrapper that can wrap any IEmailAdapter
 * to provide automatic email validation using stored User data
 */
export class ValidatedEmailAdapter implements IEmailAdapter {
  private originalAdapter: IEmailAdapter;

  constructor(originalAdapter: IEmailAdapter) {
    this.originalAdapter = originalAdapter;
  }

  async init(): Promise<any> {
    return this.originalAdapter.init();
  }

  async test(email: string): Promise<boolean> {
    return this.originalAdapter.test(email);
  }

  async mailSend(mail: XcEmail): Promise<any> {
    // Check if email validation is enabled
    if (!EmailValidationHelper.isEnabled()) {
      return this.originalAdapter.mailSend(mail);
    }

    // Check stored validation for the recipient email
    const shouldSkip = await this.shouldSkipEmail(mail.to);
    if (shouldSkip) {
      logger.warn(`Email skipped for ${mail.to} due to validation failure`);
      return false;
    }

    return this.originalAdapter.mailSend(mail);
  }

  /**
   * Check if email should be skipped based on stored validation data
   * If no validation data exists, perform validation and store result
   */
  private async shouldSkipEmail(
    email: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    try {
      // Get user by email to check stored validation
      const user = await User.getByEmail(email, ncMeta);

      if (!user || !user.email_validation) {
        // No stored validation data - validate directly and store result
        logger.debug(
          `No validation data found for ${email}, validating now...`,
        );

        const isDeliverable = await EmailValidationHelper.validateAndStoreEmail(
          email,
          ncMeta,
        );
        return !isDeliverable; // Skip if not deliverable
      }

      const validationData = parseMetaProp(user, 'email_validation');
      const config = EmailValidationHelper.getConfig();

      // Check validation results against configuration
      if (validationData.status === 'undeliverable') {
        return true; // Skip undeliverable emails
      }

      if (validationData.score < config.minScore) {
        return true; // Skip low score emails
      }

      if (!config.allowDisposable && validationData.isDisposable === true) {
        return true; // Skip disposable emails if not allowed
      }

      if (!config.allowRole && validationData.isRole === true) {
        return true; // Skip role emails if not allowed
      }

      if (!config.allowRisky && validationData.status === 'risky') {
        return true; // Skip risky emails if not allowed
      }

      return false; // Email passed validation
    } catch (error) {
      logger.error(`Error checking email validation for ${email}:`, error);
      return false; // On error, allow email to be sent
    }
  }
}

/**
 * Email validation helper using Emailable API
 * @see https://emailable.com/api/
 */
export class EmailValidationHelper {
  private static config: EmailValidationConfig | null = null;

  /**
   * Initialize email validation with configuration
   */
  public static init(config: EmailValidationConfig): void {
    this.config = config;
    logger.log('Email validation initialized', {
      minScore: config.minScore,
      allowRisky: config.allowRisky,
      allowRole: config.allowRole,
      allowDisposable: config.allowDisposable,
    });
  }

  /**
   * Check if email validation is enabled
   */
  public static isEnabled(): boolean {
    return this.config !== null && !!this.config.apiKey;
  }

  /**
   * Get current configuration
   */
  public static getConfig(): EmailValidationConfig {
    return (
      this.config || {
        minScore: 70,
        allowRisky: true,
        allowRole: true,
        allowDisposable: false,
      }
    );
  }

  /**
   * Validate email and store result in User table
   */
  public static async validateAndStoreEmail(
    email: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    if (!this.isEnabled()) {
      logger.debug('Email validation disabled - no API key provided');
      return true;
    }

    try {
      // Check if we already have validation data
      const user = await User.getByEmail(email, ncMeta);
      if (user?.email_validation) {
        const existingValidation =
          typeof user.email_validation === 'string'
            ? JSON.parse(user.email_validation)
            : user.email_validation;
        // Check if validation is recent (within 30 days)
        const checkedAt = new Date(existingValidation.checkedAt);
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

        if (checkedAt > sixtyDaysAgo) {
          logger.debug(`Using cached validation for ${email}`);
          return this.isEmailDeliverable(existingValidation);
        }
      }

      // Perform API validation
      const result = await this.validateEmail(email);

      // Store validation result - only include meaningful values
      const validationData: any = {
        status: result.state,
        score: result.score,
        checkedAt: new Date().toISOString(),
      };

      // Only store flags that are true (exclude false values to save space)
      if (result.isDisposable) validationData.isDisposable = true;
      if (result.isRole) validationData.isRole = true;
      if (result.acceptAll) validationData.acceptAll = true;
      if (result.free) validationData.free = true;
      if (result.mailboxFull) validationData.mailboxFull = true;
      if (result.noReply) validationData.noReply = true;

      // Only store reason if it provides useful information
      if (result.reason && result.reason !== 'accepted_email') {
        validationData.reason = result.reason;
      }

      // Only store typo suggestions if they exist
      if (result.didYouMean) {
        validationData.didYouMean = result.didYouMean;
      }

      if (user) {
        await User.update(
          user.id,
          {
            email_validation: JSON.stringify(validationData),
          },
          ncMeta,
        );
      }

      logger.log(`Email validation completed for ${email}:`, {
        status: result.state,
        score: result.score,
        isDisposable: result.isDisposable,
        isRole: result.isRole,
      });

      return result.isDeliverable;
    } catch (error) {
      logger.error(`Email validation failed for ${email}:`, error);
      return true; // On error, assume email is valid
    }
  }

  /**
   * Check if email is deliverable based on validation data
   */
  private static isEmailDeliverable(validationData: any): boolean {
    const config = this.getConfig();

    if (validationData.status === 'undeliverable') {
      return false;
    }

    if (validationData.score < config.minScore) {
      return false;
    }

    if (!config.allowDisposable && validationData.isDisposable === true) {
      return false;
    }

    if (!config.allowRole && validationData.isRole === true) {
      return false;
    }

    if (!config.allowRisky && validationData.status === 'risky') {
      return false;
    }

    return true;
  }

  /**
   * Validate email using Emailable API
   */
  public static async validateEmail(
    email: string,
  ): Promise<EmailValidationResult> {
    if (!this.config?.apiKey) {
      throw new Error('Email validation API key not configured');
    }

    try {
      const response = await axios.get(
        `https://api.emailable.com/v1/verify?email=${encodeURIComponent(
          email,
        )}&api_key=${this.config.apiKey}`,
        {
          timeout: 10000, // 10 second timeout
        },
      );

      const data = response.data;

      return {
        isValid: data.state === 'deliverable',
        isDeliverable: data.state === 'deliverable',
        isDisposable: data.disposable || false,
        isRole: data.role || false,
        score: data.score || 0,
        reason: data.reason,
        state: data.state || 'unknown',
        // Additional Emailable API fields
        acceptAll: data.accept_all || false,
        free: data.free || false,
        didYouMean: data.did_you_mean || null,
        mailboxFull: data.mailbox_full || false,
        noReply: data.no_reply || false,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Emailable API error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
      } else {
        logger.error('Email validation error:', error);
      }

      // Return a safe default on error
      return {
        isValid: true,
        isDeliverable: true,
        isDisposable: false,
        isRole: false,
        score: 50,
        state: 'unknown',
        acceptAll: false,
        free: false,
        didYouMean: null,
        mailboxFull: false,
        noReply: false,
      };
    }
  }

  /**
   * Check if email should be skipped based on User table validation data
   * @deprecated Use ValidatedEmailAdapter instead for generic email validation
   */
  public static async shouldSkipEmail(
    email: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const user = await User.getByEmail(email, ncMeta);
      if (!user?.email_validation) {
        return false; // No validation data, allow email
      }

      const validationData =
        typeof user.email_validation === 'string'
          ? JSON.parse(user.email_validation)
          : user.email_validation;
      return !this.isEmailDeliverable(validationData);
    } catch (error) {
      logger.error(`Error checking email validation for ${email}:`, error);
      return false; // On error, allow email
    }
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
