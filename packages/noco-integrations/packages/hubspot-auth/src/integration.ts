import axios, { type AxiosInstance } from 'axios';
import {
  AuthIntegration,
  AuthType,
  createAxiosInstance,
} from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import { APP_LABEL } from './constant';
import type { RateLimitOptions } from '@noco-integrations/core';
import type { HubspotAuthConfig } from './types';
import type { TestConnectionResponse } from '@noco-integrations/core';

export class HubspotAuthIntegration extends AuthIntegration<
  HubspotAuthConfig,
  AxiosInstance
> {
  public client: AxiosInstance | null = null;

  // Rate limit configuration
  // https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines
  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 100,
        perMilliseconds: 10 * 1000, // 100 per 10 secs
      },
      maxQueueSize: 100,
    };
  }

  public async authenticate(): Promise<AxiosInstance> {
    let accessToken: string;
    switch (this.config.type) {
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
        baseURL: 'https://api.hubapi.com',
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
        await client.post('/account-info/v3/details', null);
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

  // https://developers.hubspot.com/docs/apps/legacy-apps/authentication/oauth-quickstart-guide
  public async exchangeToken(payload: { code: string }): Promise<{
    oauth_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const { code } = payload;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri!,
      code: code,
    });

    const response = await axios.post(tokenUri, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: payload.refresh_token,
    });

    const response = await axios.post(tokenUri, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return {
      oauth_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    };
  }
}
