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
import type { ZohoAuthConfig } from './types';
import type { AxiosInstance } from 'axios';
import type {
  RateLimitOptions,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class ZohoAuthIntegration extends AuthIntegration<
  ZohoAuthConfig,
  AxiosInstance
> {
  // https://projects.zoho.com/api-docs#Errors
  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 45, // 45 per minute = 90 per 2 minutes (safe)
        perMilliseconds: 60000, // 1 minute
      },
    };
  }

  public async authenticate(): Promise<AxiosInstance> {
    if (!this.config.region) {
      throw new Error('Missing required Zoho region');
    }

    const apiBaseUrl = getApiBaseUrl(this.config.region);

    let accessToken: string;
    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error('Missing required Zoho API token');
        }
        accessToken = this.config.token;
        break;

      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('Missing required Zoho OAuth token');
        }
        accessToken = this.config.oauth_token;
        break;

      default:
        throw new Error(
          `Unsupported authentication type: ${(this.config as any).type}`,
        );
    }

    this.client = createAxiosInstance(
      {
        baseURL: apiBaseUrl,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      },
      this.getRateLimitConfig(),
    );

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const response = await this.use(async (client) => {
        // Test connection by fetching portals (workspaces in Zoho)
        // https://www.zoho.com/projects/help/rest-api/portals-api.html
        return await client.get('/portals/');
      });

      if (response.data.error) {
        return {
          success: false,
          message: `Zoho API error: ${JSON.stringify(response.data.error)}`,
        };
      }

      return {
        success: true,
      };
    } catch (error: any) {
      // Handle specific Zoho API errors
      if (error?.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid token or unauthorized access',
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
          message: 'Resource not found - check region and endpoint',
        };
      }

      if (error?.response?.status === 429) {
        return {
          success: false,
          message: 'Rate limit exceeded - please try again later',
        };
      }

      // Check for Zoho-specific error format in response body
      if (error?.response?.data?.error) {
        return {
          success: false,
          message: `Zoho API error: ${JSON.stringify(error.response.data.error)}`,
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
    if (!this.config.region) {
      throw new Error('Missing required Zoho region');
    }

    const { code, code_verifier } = payload;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      redirect_uri: redirectUri!,
    });

    // Zoho supports PKCE but it's optional
    if (code_verifier) {
      params.append('code_verifier', code_verifier);
    }

    try {
      const response = await axios.post(
        getTokenUri(this.config.region),
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
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
      throw new Error(`Failed to exchange Zoho token: ${message}`);
    }
  }

  public async refreshToken(payload: { refresh_token: string }): Promise<{
    oauth_token: string;
    refresh_token: string;
    expires_in?: number;
  }> {
    if (!this.config.region) {
      throw new Error('Missing required Zoho region');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: payload.refresh_token,
      client_id: clientId!,
      client_secret: clientSecret!,
    });

    try {
      const response = await axios.post(
        getTokenUri(this.config.region),
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
        },
      );

      return {
        oauth_token: response.data.access_token,
        refresh_token: response.data.refresh_token || payload.refresh_token,
        expires_in: response.data.expires_in,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to refresh Zoho token: ${message}`);
    }
  }

  /**
   * Override to detect Zoho-specific token expiration errors
   */
  protected shouldRefreshToken(err: any): boolean {
    const config = this.config as any;

    // Only refresh for OAuth configurations with refresh tokens
    if (config.type !== AuthType.OAuth || !config.refresh_token) {
      return false;
    }

    // Zoho returns 401 for expired tokens
    const status = err?.response?.status;
    if (status === 401) {
      return true;
    }

    // Check for Zoho-specific authentication errors
    const errorCode = err?.response?.data?.error?.code;
    if (
      errorCode === 'INVALID_TOKEN' ||
      errorCode === 'AUTHENTICATION_FAILURE'
    ) {
      return true;
    }

    // Fall back to base class logic
    return super.shouldRefreshToken(err);
  }

  /**
   * Clean up resources
   */
  public async destroy(): Promise<void> {
    this.client = null;
  }
}
