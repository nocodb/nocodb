import axios from 'axios';
import { Client } from '@microsoft/microsoft-graph-client';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import { APP_LABEL } from './constant';
import type { RateLimitOptions } from '@noco-integrations/core';
import type { OutlookAuthConfig } from './types';
import type { TestConnectionResponse } from '@noco-integrations/core';

export class OutlookAuthIntegration extends AuthIntegration<
  OutlookAuthConfig,
  Client
> {
  public client: Client | null = null;

  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 10000,
        perMilliseconds: 60 * 1000,
      },
      maxQueueSize: 100,
    };
  }

  public async authenticate(): Promise<Client> {
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

    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      return await this.use(async (client) => {
        await client.api('/me').get();
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
