import type { AxiosInstance } from 'axios'
import axios from 'axios'
import type { RateLimitOptions, TestConnectionResponse } from '@noco-integrations/core'
import { AuthIntegration, AuthType, createAxiosInstance } from '@noco-integrations/core'
import { clientId, clientSecret, tokenUri } from './config'

// TODO: Import your provider's SDK/client library
// import { ProviderSDK } from 'provider-sdk';

/**
 * TODO: Define your provider's configuration types
 * Replace 'Provider' with your actual provider name (e.g., Slack, Stripe, etc.)
 */
interface ProviderApiKeyConfig {
  type: AuthType.ApiKey;
  token: string;
  // TODO: Add provider-specific fields
  // baseUrl?: string;
  // organizationId?: string;
}

interface ProviderOAuthConfig {
  type: AuthType.OAuth;
  oauth_token: string;
  refresh_token: string;
  expires_in?: number;
  // TODO: Add provider-specific fields
  // baseUrl?: string;
  // organizationId?: string;
}

type ProviderConfig = ProviderApiKeyConfig | ProviderOAuthConfig;

/**
 * Provider Authentication Integration
 *
 * Implements authentication for [Provider Name] API.
 * Supports both API Key and OAuth 2.0 authentication.
 *
 * @see https://provider-docs-url.com/authentication
 *
 * TODO Checklist:
 * 1. Replace 'Provider' with your actual provider name
 * 2. Import your provider's SDK/client library
 * 3. Update config interfaces with provider-specific fields
 * 4. Implement authenticate() with proper client initialization
 * 5. Update testConnection() with provider-specific API call
 * 6. Implement exchangeToken() for OAuth flow
 * 7. Implement refreshToken() if provider supports token refresh
 * 8. Configure rate limiting if needed
 * 9. Add provider-specific error handling
 * 10. Update documentation and examples
 */
// TODO: Replace with your provider's client type
export class ProviderAuthIntegration extends AuthIntegration <ProviderConfig, AxiosInstance> {
  public async authenticate(): Promise<AxiosInstance> {
    // TODO: Replace with your provider's SDK initialization

    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error('Missing required Provider API token')
        }

        // OPTION 1: Using provider's SDK
        // this.client = new ProviderSDK({
        //   apiKey: this.config.token,
        //   baseUrl: this.config.baseUrl || 'https://api.provider.com',
        // });

        // OPTION 2: Using axios for REST API
        this.client = createAxiosInstance({
          baseURL: 'https://api.provider.com', headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }, this.getRateLimitConfig())
        break

      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('Missing required Provider OAuth token')
        }

        // OPTION 1: Using provider's SDK
        // this.client = new ProviderSDK({
        //   accessToken: this.config.oauth_token,
        //   baseUrl: this.config.baseUrl || 'https://api.provider.com',
        // });

        // OPTION 2: Using axios for REST API
        this.client = createAxiosInstance({
          baseURL: 'https://api.provider.com', headers: {
            'Authorization': `Bearer ${this.config.oauth_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }, this.getRateLimitConfig())
        break

      default:
        throw new Error(`Unsupported authentication type: ${(this.config as any).type}`)
    }

    return this.client
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      // Use the `use()` method which handles token refresh automatically
      await this.use(async (client) => {
        // TODO: Replace with your provider's test API call
        // Examples:
        // - await client.users.me();
        // - await client.get('/user');
        // - await client.getCurrentUser();

        await client.get('/user') // Example REST API call
      })

      return {
        success: true,
      }
    } catch (error: any) {
      // TODO: Add provider-specific error handling

      if (error?.response?.status === 401) {
        return {
          success: false, message: 'Invalid token or unauthorized access',
        }
      }

      if (error?.response?.status === 403) {
        return {
          success: false, message: 'Access forbidden - check permissions',
        }
      }

      if (error?.response?.status === 404) {
        return {
          success: false, message: 'Resource not found - check endpoint',
        }
      }

      if (error?.response?.status === 429) {
        return {
          success: false, message: 'Rate limit exceeded - please try again later',
        }
      }

      // TODO: Add provider-specific error codes
      // if (error?.code === 'PROVIDER_SPECIFIC_ERROR') {
      //   return {
      //     success: false,
      //     message: 'Provider-specific error message',
      //   };
      // }

      return {
        success: false, message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async exchangeToken(payload: {
    code: string; code_verifier?: string;
  }): Promise<{
    oauth_token: string; refresh_token?: string; expires_in?: number;
  }> {
    const { code, code_verifier } = payload

    // TODO: Update based on your provider's OAuth flow
    // Some providers use JSON, others use form-urlencoded

    // OPTION 1: Form-urlencoded (most common)
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId!,
      client_secret: clientSecret!,
      code, // redirect_uri: redirectUri!, // Add if required
    })

    if (code_verifier) {
      params.append('code_verifier', code_verifier)
    }

    try {
      const response = await axios.post(tokenUri, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json',
        },
      })

      // OPTION 2: JSON format (less common)
      // const response = await axios.post(tokenUri, {
      //   grant_type: 'authorization_code',
      //   client_id: clientId,
      //   client_secret: clientSecret,
      //   code,
      //   code_verifier,
      // }, {
      //   headers: {
      //     'Content-Type': 'application/json',
      //     Accept: 'application/json',
      //   },
      // });

      return {
        oauth_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to exchange Provider token: ${message}`)
    }
  }

  /**
   * TODO: Implement if your provider supports OAuth token refresh
   * Remove this method if tokens don't expire or can't be refreshed
   */
  public async refreshToken(payload: {
    refresh_token: string;
  }): Promise<{
    oauth_token: string; refresh_token?: string; expires_in?: number;
  }> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: payload.refresh_token,
      client_id: clientId!,
      client_secret: clientSecret!,
    })

    try {
      const response = await axios.post(tokenUri, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json',
        },
      })

      return {
        oauth_token: response.data.access_token,
        refresh_token: response.data.refresh_token || payload.refresh_token,
        expires_in: response.data.expires_in,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to refresh Provider token: ${message}`)
    }
  }

  /**
   * Clean up resources
   */
  public async destroy(): Promise<void> {
    this.client = null
  }

  /**
   * TODO: Configure rate limiting for your provider
   * Remove this method if no rate limiting is needed
   *
   * Common configurations:
   * - Slack: 1 request per second per token
   * - Stripe: 100 requests per second
   * - GitHub: 5,000 requests per hour
   * - Twitter: 300 requests per 15 minutes
   *
   * @see https://provider-docs-url.com/rate-limits
   */
  protected getRateLimitConfig(): RateLimitOptions | null {
    // EXAMPLE 1: Simple global limit
    return {
      global: {
        maxRequests: 100, perMilliseconds: 60000, // 1 minute
      },
    }

    // EXAMPLE 2: No rate limiting
    // return null;

    // EXAMPLE 3: Per-endpoint limits (if needed)
    // return {
    //   global: {
    //     maxRequests: 100,
    //     perMilliseconds: 60000,
    //   },
    //   perEndpoint: {
    //     '/search': {
    //       maxRequests: 10,
    //       perMilliseconds: 60000,
    //     },
    //   },
    // };
  }

  /**
   * TODO: Override if your provider has specific token expiration detection
   * The base class already handles common cases (401, 403, "token expired")
   */
  protected shouldRefreshToken(err: any): boolean {
    const config = this.config as any

    // Only refresh for OAuth configurations with refresh tokens
    if (config.type !== AuthType.OAuth || !config.refresh_token) {
      return false
    }

    // TODO: Add provider-specific error detection
    // Example: Check for provider-specific error codes
    // if (err?.response?.data?.error?.code === 'TOKEN_EXPIRED') {
    //   return true;
    // }

    // Fall back to base class logic (handles 401, 403, etc.)
    return super.shouldRefreshToken(err)
  }
}