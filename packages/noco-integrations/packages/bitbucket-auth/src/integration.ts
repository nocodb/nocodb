import axios, { type AxiosInstance } from 'axios';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class BitbucketAuthIntegration extends AuthIntegration {
  public client: AxiosInstance | null = null;

  private async handleTokenRefresh(): Promise<void> {
    if (!this.config.refresh_token) {
      throw new Error('No refresh token available');
    }

    try {
      const tokens = await this.refreshToken({
        refresh_token: this.config.refresh_token,
      });

      (this._config as any).oauth_token = tokens.oauth_token;
      if (tokens.refresh_token) {
        (this._config as any).refresh_token = tokens.refresh_token;
      }
      if (tokens.expires_in) {
        (this._config as any).expires_in = tokens.expires_in;
      }

      if (this.tokenRefreshCallback) {
        await this.tokenRefreshCallback(tokens);
      }
    } catch (error) {
      console.log('Failed to refresh token: ' + error);
      throw error;
    }
  }

  public async authenticate(): Promise<AuthResponse<AxiosInstance>> {
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

    this.client = axios.create({
      baseURL: 'https://api.bitbucket.org/2.0',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const client = await this.authenticate();

      if (!client) {
        return {
          success: false,
          message: 'Missing Bitbucket client',
        };
      }

      try {
        // Test connection by fetching current user
        await client.get('/repositories');
        return {
          success: true,
        };
      } catch (error: any) {
        // Check for authentication errors and attempt token refresh
        if (
          (error?.response?.status === 401 || error?.response?.status === 403) &&
          this.config.type === AuthType.OAuth &&
          this.config.refresh_token
        ) {
          try {
            await this.handleTokenRefresh();

            const newClient = await this.authenticate();

            await newClient.get('/user');
            return {
              success: true,
            };
          } catch (refreshError) {
            return {
              success: false,
              message:
                refreshError instanceof Error
                  ? `Token refresh failed: ${refreshError.message}`
                  : 'Token refresh failed',
            };
          }
        }

        throw error;
      }
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
    const [code, codeVerifier] = payload.code.includes('|')
      ? payload.code.split('|')
      : [payload.code, payload.code_verifier];

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
