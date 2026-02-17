import { IntegrationWrapper } from '../integration';
import { RateLimitOptions } from '../utils/axios';
import { TokenData, TestConnectionResponse, AuthType } from './types'

/**
 * Abstract base class for authenticated integrations.
 */
export abstract class AuthIntegration<TConfig = any, TClient = any> extends IntegrationWrapper<TConfig> {
  /** The authenticated API client instance */
  public client: TClient | null = null;

  /** Whether a token refresh is currently in progress */
  private refreshingPromise: Promise<void> | null = null;

  /** Optional callback for persisting refreshed tokens (e.g., update DB) */
  protected tokenRefreshCallback?: (tokens: TokenData) => Promise<void>;

  /**
   * Override in subclass to define per-integration rate limit behavior.
   */
  protected getRateLimitConfig(): RateLimitOptions | null {
    return null; // No rate limiting by default
  }

  /**
   * Register a callback to persist refreshed tokens.
   */
  public setTokenRefreshCallback(callback: (tokens: TokenData) => Promise<void>) {
    this.tokenRefreshCallback = callback;
  }

  /**
   * Authenticate and initialize the API client.
   */
  public abstract authenticate(): Promise<TClient>;

  /**
   * Verifies that current credentials and connection are valid.
   */
  public abstract testConnection(): Promise<TestConnectionResponse>;

  /**
   * Optional: Exchange OAuth authorization code for tokens.
   */
  public exchangeToken?(oauthPayload: Record<string, any>): Promise<Record<string, any>>;

  /**
   * Optional: Refresh an expired OAuth token.
   */
  public refreshToken?(payload: { refresh_token: string }): Promise<Record<string, any>>;

  /**
   * Optional: Clean up client resources.
   */
  public destroy?(): Promise<void>;

  /**
   * Wraps a client call with token refresh & retry support.
   * Automatically reauthenticates if needed.
   */
  public async use<T>(fn: (client: TClient) => Promise<T>): Promise<T> {
    if (!this.client) {
      this.client = await this.authenticate();
    }

    try {
      return await fn(this.client);
    } catch (err: any) {
      if (this.shouldRefreshToken(err)) {
        await this.refreshTokenIfNeeded();
        if (!this.client) this.client = await this.authenticate();
        return await fn(this.client);
      }
      throw err;
    }
  }

  /**
   * Determines whether a given error indicates an expired/invalid token.
   */
  protected shouldRefreshToken(err: any): boolean {
    const config = this.config as any;

    if (config.type !== AuthType.OAuth) {
      return false;
    }

    const status = err?.response?.status || err?.status;
    const message = (err?.message || '').toLowerCase();
    return (
      [401, 403].includes(status) ||
      message.includes('token expired') ||
      message.includes('invalid_grant') ||
      message.includes('unauthorized')
    );
  }

  /**
   * Ensures only one token refresh happens at a time.
   */
  private async refreshTokenIfNeeded(): Promise<void> {
    if (this.refreshingPromise) {
      await this.refreshingPromise; // Wait for the existing one
      return;
    }

    if (!this.refreshToken || !(this.config as any)?.refresh_token) {
      throw new Error('Refresh token not available for this integration');
    }

    this.refreshingPromise = (async () => {
      try {
        const newTokens = await this.refreshToken!({
          refresh_token: (this.config as any).refresh_token!,
        });

        // Persist the refreshed tokens if needed
        if (this.tokenRefreshCallback) {
          await this.tokenRefreshCallback(newTokens as TokenData);
        }

        // Merge tokens into local config
        Object.assign(this._config, newTokens);
        this.client = null;
      } finally {
        this.refreshingPromise = null;
      }
    })();

    await this.refreshingPromise;
  }
}