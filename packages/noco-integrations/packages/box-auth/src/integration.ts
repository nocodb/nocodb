import axios, { type AxiosInstance } from 'axios';
import {
  AuthIntegration,
  AuthType,
  createAxiosInstance,
} from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import { APP_LABEL } from './constant';
import type { RateLimitOptions } from '@noco-integrations/core';
import type { BoxAuthConfig } from './types';
import type { TestConnectionResponse } from '@noco-integrations/core';

/**
 * Box Authentication Integration
 *
 * Implements authentication for Box API v2.
 * Supports OAuth 2.0 authentication.
 *
 * @see https://developer.box.com/guides/authentication/
 */
export class BoxAuthIntegration extends AuthIntegration<
  BoxAuthConfig,
  AxiosInstance
> {
  public client: AxiosInstance | null = null;

  // Rate limit configuration for Box API
  // Box allows 200 requests per minute per user
  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 200,
        perMilliseconds: 60 * 1000, // 1 minute window
      },
      maxQueueSize: 100,
    };
  }

  public async authenticate(): Promise<AxiosInstance> {
    let accessToken: string;
    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error(`Missing required ${APP_LABEL} access token`);
        }
        accessToken = this.config.token;
        break;

      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error(`Missing required ${APP_LABEL} OAuth token`);
        }
        accessToken = this.config.oauth_token;
        break;

      default:
        throw new Error('Not implemented');
    }

    this.client = createAxiosInstance(
      {
        baseURL: 'https://api.box.com/2.0',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
      this.getRateLimitConfig(),
    );

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      return await this.use(async (client) => {
        // Test connection by getting current user information
        await client.get('/users/me');
        return {
          success: true,
        };
      });
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Exchange authorization code for access token
   * @see https://developer.box.com/guides/authentication/oauth2/oauth2-setup/
   */
  public async exchangeToken(payload: {
    code: string;
    code_verifier?: string;
  }): Promise<{
    oauth_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const { code, code_verifier } = payload;

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri!);
    params.append('client_id', clientId!);
    params.append('client_secret', clientSecret!);

    if (code_verifier) {
      params.append('code_verifier', code_verifier);
    }

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
  }

  /**
   * Refresh access token using refresh token
   * @see https://developer.box.com/guides/authentication/oauth2/oauth2-setup/
   */
  public async refreshToken(payload: { refresh_token: string }): Promise<{
    oauth_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', payload.refresh_token);
    params.append('client_id', clientId!);
    params.append('client_secret', clientSecret!);

    const response = await axios.post(tokenUri, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });

    return {
      oauth_token: response.data.access_token,
      refresh_token: response.data.refresh_token || payload.refresh_token,
      expires_in: response.data.expires_in,
    };
  }
}
