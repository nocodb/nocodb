import type { IEmailAdapter } from '~/types/nc-plugin';
import type { XcEmail } from '~/interface/IEmailAdapter';

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
 * Email validation wrapper - passes through all emails
 */
export class ValidatedEmailAdapter implements IEmailAdapter {
  protected originalAdapter: IEmailAdapter;

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
    // Pass through all emails without validation
    return this.originalAdapter.mailSend(mail);
  }
}

/**
 * Email validation helper with no-op functions
 */
export class EmailValidationHelper {
  protected static config: EmailValidationConfig | null = null;

  /**
   * Initialize email validation configuration
   */
  public static init(config?: EmailValidationConfig): void {
    // No operation required
  }

  /**
   * Check if email validation is enabled
   */
  public static isEnabled(): boolean {
    return false;
  }

  /**
   * Get current configuration
   */
  public static getConfig(): EmailValidationConfig {
    return {
      minScore: 0,
      allowRisky: true,
      allowRole: true,
      allowDisposable: true,
    };
  }

  /**
   * Check if email should be skipped based on validation data
   */
  public static shouldSkipBasedOnValidationData(validationData: any): boolean {
    return false;
  }

  /**
   * Validate email using API
   */
  public static async validateEmail(
    email: string,
  ): Promise<EmailValidationResult | null> {
    // Return null when validation is not available
    return null;
  }

  /**
   * Validate email and store result
   */
  public static async validateAndStoreEmailForUser(
    email: string,
    existingUser?: any,
    ncMeta?: any,
  ): Promise<boolean> {
    // Always allow emails
    return true;
  }

  /**
   * Validate email and store result
   */
  public static async validateAndStoreEmail(
    email: string,
    ncMeta?: any,
  ): Promise<boolean> {
    // Always allow emails
    return true;
  }

  /**
   * Check if email should be skipped
   */
  public static async shouldSkipEmail(
    email: string,
    ncMeta?: any,
  ): Promise<boolean> {
    // Never skip any emails
    return false;
  }
}

/**
 * Initialize email validation from environment variables
 */
export function initEmailValidationFromEnv(): void {
  // No operation required
}
