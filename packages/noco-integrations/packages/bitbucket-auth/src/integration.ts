import axios, { type AxiosInstance } from 'axios';
import { AuthIntegration, AuthType, createAxiosInstance } from '@noco-integrations/core'
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import type { RateLimitOptions } from '@noco-integrations/core'
import type { BitBucketAuthConfig } from './types'
import type {
  TestConnectionResponse,
} from '@noco-integrations/core';

export class BitbucketAuthIntegration extends AuthIntegration<BitBucketAuthConfig, AxiosInstance> {
  public client: AxiosInstance | null = null;

  // RateLimit- https://support.atlassian.com/bitbucket-cloud/docs/api-request-limits/
  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 16,// ~960 requests/hour
        perMilliseconds: 60 * 1000, // 1 minute window
      },
      maxQueueSize: 50,
    };
  }

  public async authenticate(): Promise<AxiosInstance> {
    let accessToken: string;

    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error('Missing required Bitbucket access token');
        }
        accessToken = this.config.token;
        break;

      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('Missing required Bitbucket OAuth token');
        }
        accessToken = this.config.oauth_token;
        break;

      default:
        throw new Error('Not implemented');
    }

    this.client= createAxiosInstance({
      baseURL: 'https://api.bitbucket.org/2.0',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }, this.getRateLimitConfig())

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      return await this.use(async (client) => {
        await client.get('/repositories');
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

  // https://developer.atlassian.com/cloud/bitbucket/oauth-2/
  public async exchangeToken(payload: {
    code: string;
    code_verifier?: string;
  }): Promise<{
    oauth_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const code = payload.code;
    const codeVerifier = payload.code_verifier;

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri!);

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    const response = await axios.post(
      tokenUri,
      params.toString(),
      {
        auth: {
          username: clientId!,
          password: clientSecret!,
        },
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
  }

  public async refreshToken(payload: { refresh_token: string }): Promise<{
    oauth_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', payload.refresh_token);

    const response = await axios.post(
      tokenUri,
      params.toString(),
      {
        auth: {
          username: clientId!,
          password: clientSecret!,
        },
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
  }
}