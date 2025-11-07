import axios from 'axios';
import { LinearClient } from '@linear/sdk';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class LinearAuthIntegration extends AuthIntegration {
  public client: LinearClient | null = null;

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

  public async authenticate(): Promise<AuthResponse<LinearClient>> {
    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error('Missing required Linear API token');
        }

        this.client = new LinearClient({
          apiKey: this.config.token,
        });

        return this.client;
      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('Missing required Linear OAuth token');
        }

        this.client = new LinearClient({
          accessToken: this.config.oauth_token,
        });

        return this.client;
      default:
        throw new Error('Not implemented');
    }
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const client = await this.authenticate();

      if (!client) {
        return {
          success: false,
          message: 'Missing Linear client',
        };
      }

      try {
        await client.viewer;
        return {
          success: true,
        };
      } catch (error: any) {
        // Check for authentication errors and attempt token refresh
        if (
          (error?.message?.includes('Authentication required')) &&
          this.config.type === AuthType.OAuth &&
          this.config.refresh_token
        ) {
          try {
            await this.handleTokenRefresh();

            const newClient = await this.authenticate();

            await newClient.viewer;
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
    params.append('client_id', clientId!);
    params.append('code', code);
    params.append('redirect_uri', redirectUri!);
    params.append('code_verifier', codeVerifier!);
    params.append('client_secret', clientSecret!);

    const response = await axios.post(
      tokenUri,
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

    const response = await axios.post(
      tokenUri,
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
  }
}
