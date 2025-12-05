import axios, { type AxiosInstance } from 'axios';
import {
  AuthIntegration,
  AuthType,
  createAxiosInstance,
} from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import { APP_LABEL } from './constant';
import type { RateLimitOptions } from '@noco-integrations/core';
import type { DropboxAuthConfig } from './types';
import type { TestConnectionResponse } from '@noco-integrations/core';

export class DropboxAuthIntegration extends AuthIntegration<
  DropboxAuthConfig,
  AxiosInstance
> {
  public client: AxiosInstance | null = null;

  // Rate limit configuration for Dropbox API
  // Dropbox allows 600 requests per minute per user
  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 600,
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
        baseURL: 'https://api.dropbox.com/2',
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
        // Test connection by getting current account info
        await client.post('/users/get_current_account', null);
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

  // https://www.dropbox.com/developers/reference/oauth-guide
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

    if (code_verifier) {
      params.append('code_verifier', code_verifier);
    }

    const response = await axios.post(tokenUri, params.toString(), {
      auth: {
        username: clientId!,
        password: clientSecret!,
      },
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

  public async refreshToken(payload: { refresh_token: string }): Promise<{
    oauth_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', payload.refresh_token);

    const response = await axios.post(tokenUri, params.toString(), {
      auth: {
        username: clientId!,
        password: clientSecret!,
      },
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
}
