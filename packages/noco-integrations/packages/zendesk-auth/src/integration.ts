import axios from 'axios';
import {
  AuthIntegration,
  AuthType,
  createAxiosInstance,
} from '@noco-integrations/core';
import {
  clientId,
  clientSecret,
  getApiBaseUrl,
  getTokenUri,
  redirectUri,
} from './config';
import type { AxiosInstance } from 'axios';
import type { ZendeskAuthConfig } from './types';
import type {
  RateLimitOptions,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class ZendeskAuthIntegration extends AuthIntegration<
  ZendeskAuthConfig,
  AxiosInstance
> {
  // https://developer.zendesk.com/api-reference/sales-crm/rate-limits/
  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 36000,
        perMilliseconds: 3600000, // 1 hour in milliseconds
      },
    };
  }

  public async authenticate(): Promise<AxiosInstance> {
    if (!this.config.subdomain) {
      throw new Error('Missing required Zendesk subdomain');
    }

    const apiBaseUrl = getApiBaseUrl(this.config.subdomain);

    switch (this.config.type) {
      case AuthType.ApiKey: {
        if (!this.config.email || !this.config.token) {
          throw new Error('Missing required Zendesk email or API token');
        }

        // For API Key auth, create a token from email/token combination
        const auth = Buffer.from(
          `${this.config.email}/token:${this.config.token}`,
        ).toString('base64');

        this.client = createAxiosInstance(
          {
            baseURL: apiBaseUrl,
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
          this.getRateLimitConfig(),
        );
        break;
      }

      case AuthType.OAuth: {
        if (!this.config.oauth_token) {
          throw new Error('Missing required Zendesk OAuth token');
        }

        this.client = createAxiosInstance(
          {
            baseURL: apiBaseUrl,
            headers: {
              Authorization: `Bearer ${this.config.oauth_token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
          this.getRateLimitConfig(),
        );
        break;
      }

      default:
        throw new Error(
          `Unsupported authentication type: ${(this.config as any).type}`,
        );
    }

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const response = await this.use(async (client) => {
        return await client.get('/users/me.json');
      });

      if (response.data && response.data.user) {
        return {
          success: true,
        };
      }

      return {
        success: false,
        message: 'Failed to verify Zendesk connection',
      };
    } catch (error: any) {
      // Handle specific Zendesk API errors
      if (error?.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid credentials or unauthorized access',
        };
      }

      if (error?.response?.status === 403) {
        return {
          success: false,
          message: 'Access forbidden - check permissions',
        };
      }

      if (error?.response?.status === 404) {
        return {
          success: false,
          message: 'Invalid Zendesk subdomain',
        };
      }

      if (error?.response?.status === 429) {
        return {
          success: false,
          message: 'Rate limit exceeded - please try again later',
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async exchangeToken(payload: {
    code: string;
    code_verifier?: string;
  }): Promise<{
    oauth_token: string;
    refresh_token: string;
    expires_in?: number;
  }> {
    if (!this.config.subdomain) {
      throw new Error('Missing required Zendesk subdomain');
    }

    const { code, code_verifier } = payload;

    // Zendesk OAuth token request - JSON format
    const requestBody = {
      grant_type: 'authorization_code',
      code,
      code_verifier,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    };

    try {
      const response = await axios.post(
        getTokenUri(this.config.subdomain),
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      return {
        oauth_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to exchange Zendesk token: ${message}`);
    }
  }

  public async refreshToken(payload: { refresh_token: string }): Promise<{
    oauth_token: string;
    refresh_token: string;
    expires_in?: number;
  }> {
    if (!this.config.subdomain) {
      throw new Error('Missing required Zendesk subdomain');
    }

    const requestBody = {
      grant_type: 'refresh_token',
      refresh_token: payload.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    };

    try {
      const response = await axios.post(
        getTokenUri(this.config.subdomain),
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      return {
        oauth_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to refresh Zendesk token: ${message}`);
    }
  }

  /**
   * Override to detect Zendesk-specific token expiration errors
   */
  protected shouldRefreshToken(err: any): boolean {
    const config = this.config as any;

    // Only refresh for OAuth configurations with refresh tokens
    if (config.type !== AuthType.OAuth || !config.refresh_token) {
      return false;
    }

    // Zendesk returns 401 for expired tokens
    const status = err?.response?.status;
    if (status === 401) {
      return true;
    }

    // Fall back to base class logic
    return super.shouldRefreshToken(err);
  }

  public async destroy(): Promise<void> {
    this.client = null;
  }
}
