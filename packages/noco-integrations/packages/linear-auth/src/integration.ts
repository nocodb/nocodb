import axios from 'axios';
import {
  AuthIntegration,
  AuthType,
  createAxiosInstance,
} from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import type {
  RateLimitOptions,
  TestConnectionResponse,
} from '@noco-integrations/core';
import type { AxiosInstance } from 'axios';
import type { LinearAuthConfig } from './types';

export class LinearAuthIntegration extends AuthIntegration<
  LinearAuthConfig,
  AxiosInstance
> {
  public async authenticate(): Promise<AxiosInstance> {
    let accessToken: string;

    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error('Missing required Linear API token');
        }
        accessToken = this.config.token;
        break;

      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('Missing required Linear OAuth token');
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
        baseURL: 'https://api.linear.app/graphql',
        headers: {
          'Content-Type': 'application/json',
          Authorization: accessToken,
        },
      },
      this.getRateLimitConfig(),
    );

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const response = await this.use(async (client) => {
        return await client.post('', {
          query: '{ viewer { id name email } }',
        });
      });

      if (response.data.errors) {
        // Check for rate limit errors
        const rateLimitError = response.data.errors.find(
          (err: any) => err.extensions?.code === 'RATELIMITED',
        );

        if (rateLimitError) {
          return {
            success: false,
            message: 'Rate limit exceeded - please try again later',
          };
        }

        return {
          success: false,
          message: `Linear API errors: ${JSON.stringify(response.data.errors)}`,
        };
      }

      return {
        success: true,
      };
    } catch (error: any) {
      // Handle specific Linear API errors
      if (error?.response?.status === 401) {
        return {
          success: false,
          message: 'Invalid token or unauthorized access',
        };
      }

      if (error?.response?.status === 403) {
        return {
          success: false,
          message: 'Access forbidden - check token permissions',
        };
      }

      if (error?.response?.status === 429) {
        return {
          success: false,
          message: 'Rate limit exceeded - please try again later',
        };
      }

      // Check for Linear GraphQL errors
      if (error?.response?.data?.errors) {
        const rateLimitError = error.response.data.errors.find(
          (err: any) => err.extensions?.code === 'RATELIMITED',
        );

        if (rateLimitError) {
          return {
            success: false,
            message: `Rate limit exceeded: ${rateLimitError.message}`,
          };
        }

        const errorMessages = error.response.data.errors
          .map((e: any) => e.message)
          .join(', ');
        return {
          success: false,
          message: `Linear API errors: ${errorMessages}`,
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
    const { code, code_verifier } = payload;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      redirect_uri: redirectUri!,
    });

    if (code_verifier) {
      params.append('code_verifier', code_verifier);
    }

    try {
      const response = await axios.post(tokenUri, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      return {
        oauth_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to exchange Linear token: ${message}`);
    }
  }

  public async refreshToken(payload: { refresh_token: string }): Promise<{
    oauth_token: string;
    refresh_token: string;
    expires_in?: number;
  }> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: payload.refresh_token,
      client_id: clientId!,
      client_secret: clientSecret!,
    });

    try {
      const response = await axios.post(tokenUri, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      return {
        oauth_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to refresh Linear token: ${message}`);
    }
  }

  /**
   * Linear API rate limit configuration
   *
   * Linear uses two independent rate limit systems with leaky bucket algorithm:
   *
   * 1. **Request limits** (per hour):
   *    - API Key: 1,500 requests/hour
   *    - OAuth: 1,200 requests/hour
   *    - Unauthenticated: 60 requests/hour
   *
   * 2. **Complexity limits** (per hour):
   *    - API Key: 250,000 points/hour
   *    - OAuth: 200,000 points/hour
   *    - Unauthenticated: 10,000 points/hour
   *    - Max single query: 10,000 points
   *
   *
   * We implement conservative request-based throttling:
   * - API Key: 20 req/min (1,200/hour, 20% buffer)
   * - OAuth: 16 req/min (960/hour, 20% buffer)
   *
   *
   * @see https://linear.app/developers/rate-limiting
   */
  protected getRateLimitConfig(): RateLimitOptions | null {
    const isApiKey = this.config.type === AuthType.ApiKey;

    // Conservative limits with 20% buffer for safety
    // API Key: 1,500/hour → 20/min (1,200/hour actual)
    // OAuth: 1,200/hour → 16/min (960/hour actual)
    const maxRequests = isApiKey ? 20 : 16;

    return {
      global: {
        maxRequests,
        perMilliseconds: 60000, // 1 minute
      },
    };
  }

  /**
   * Override to detect Linear-specific token expiration errors
   */
  protected shouldRefreshToken(err: any): boolean {
    const config = this.config as any;

    // Only refresh for OAuth configurations with refresh tokens
    if (config.type !== AuthType.OAuth || !config.refresh_token) {
      return false;
    }

    // Check for Linear-specific authentication errors
    const status = err?.response?.status;
    const isAuthError =
      status === 401 ||
      err?.response?.data?.errors?.[0]?.extensions?.code ===
        'AUTHENTICATION_ERROR' ||
      err?.message?.toLowerCase().includes('authentication');

    if (isAuthError) {
      return true;
    }

    // Fall back to base class logic
    return super.shouldRefreshToken(err);
  }
}
