import axios from 'axios';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, getApiBaseUrl, getTokenUri, redirectUri } from './config';
import type { ZendeskClient } from './config';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class ZendeskAuthIntegration extends AuthIntegration {
  public client: ZendeskClient | null = null;

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
      this.log('Failed to refresh token: ' + error);
      throw error;
    }
  }

  public async authenticate(): Promise<AuthResponse<ZendeskClient>> {
    if (!this.config.subdomain) {
      throw new Error('Missing required Zendesk subdomain');
    }

    const apiBaseUrl = getApiBaseUrl(this.config.subdomain);

    switch (this.config.type) {
      case AuthType.ApiKey: {
        if (!this.config.email || !this.config.token) {
          throw new Error('Missing required Zendesk email or API token');
        }

        // For API Key auth, create a token from email/token combination
        const auth = Buffer.from(
          `${this.config.email}/token:${this.config.token}`,
        ).toString('base64');

        this.client = {
          axios: axios.create({
            baseURL: apiBaseUrl,
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          }),
          subdomain: this.config.subdomain,
          apiBaseUrl,
        };

        return this.client;
      }

      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('Missing required Zendesk OAuth token');
        }

        this.client = {
          axios: axios.create({
            baseURL: apiBaseUrl,
            headers: {
              'Authorization': `Bearer ${this.config.oauth_token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          }),
          subdomain: this.config.subdomain,
          apiBaseUrl,
        };

        return this.client;

      default:
        throw new Error('Unsupported authentication type for Zendesk');
    }
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const client = await this.authenticate();

      if (!client) {
        return {
          success: false,
          message: 'Missing Zendesk client',
        };
      }

      try {
        // Test connection by fetching current user information
        const response = await client.axios.get('/users/me.json');

        if (response.data && response.data.user) {
          return {
            success: true,
          };
        }

        return {
          success: false,
          message: 'Failed to verify Zendesk connection',
        };
      } catch (error: any) {
        // Check for authentication errors and attempt token refresh
        if (
          (error?.response?.status === 401) &&
          this.config.type === AuthType.OAuth &&
          this.config.refresh_token
        ) {
          try {
            await this.handleTokenRefresh();

            const newClient = await this.authenticate();

            const response = await newClient.axios.get('/users/me.json');

            if (response.data && response.data.user) {
              return {
                success: true,
              };
            }

            return {
              success: false,
              message: 'Failed to verify Zendesk connection after token refresh',
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
    if (!this.config.subdomain) {
      throw new Error('Missing required Zendesk subdomain');
    }

    const [code, codeVerifier] = payload.code.includes('|')
      ? payload.code.split('|')
      : [payload.code, payload.code_verifier];

    // Zendesk OAuth token request - JSON format
    const requestBody = {
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    };

    const response = await axios.post(
      getTokenUri(this.config.subdomain),
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
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
    if (!this.config.subdomain) {
      throw new Error('Missing required Zendesk subdomain');
    }

    const requestBody = {
      grant_type: 'refresh_token',
      refresh_token: payload.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    };

    const response = await axios.post(
      getTokenUri(this.config.subdomain),
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    };
  }

  public async destroy(): Promise<void> {
    this.client = null;
  }
}
