import axios from 'axios';
import { Gitlab } from '@gitbeaker/rest';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class GitlabAuthIntegration extends AuthIntegration {
  public client: InstanceType<typeof Gitlab> | null = null;

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

      if (this.tokenRefreshCallback) {
        await this.tokenRefreshCallback(tokens);
      }
    } catch (error) {
      this.log('Failed to refresh token: ' + error);
      throw error;
    }
  }

  public async authenticate(): Promise<
    AuthResponse<InstanceType<typeof Gitlab>>
  > {
    const hostname = this.config.hostname || 'https://gitlab.com';

    switch (this.config.type) {
      case AuthType.ApiKey:
        this.client = new Gitlab({
          token: this.config.token,
          host: hostname,
        });

        return this.client;
      case AuthType.OAuth:
        this.client = new Gitlab({
          oauthToken: this.config.oauth_token,
          host: hostname,
        });

        return this.client;
      default:
        throw new Error('Not implemented');
    }
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const gitlab = await this.authenticate();

      if (!gitlab) {
        return {
          success: false,
          message: 'Missing GitLab client',
        };
      }

      try {
        await gitlab.Users.showCurrentUser();
        return {
          success: true,
        };
      } catch (error: any) {
        if (
          error.cause?.description.includes('401') &&
          this.config.type === AuthType.OAuth &&
          this.config.refresh_token
        ) {
          try {
            await this.handleTokenRefresh();

            const newGitlab = await this.authenticate();

            await newGitlab.Users.showCurrentUser();
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
  }): Promise<{ oauth_token: string; refresh_token?: string }> {
    const [code, codeVerifier] = payload.code.includes('|')
      ? payload.code.split('|')
      : [payload.code, undefined];

    const params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri!,
    });

    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }

    let response;
    try {
      response = await axios.post(tokenUri, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });
    } catch (e) {
      console.log(e);
      throw e;
    }

    return {
      oauth_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
    };
  }

  public async refreshToken(payload: {
    refresh_token: string;
  }): Promise<{ oauth_token: string; refresh_token?: string }> {
    const params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: payload.refresh_token,
      grant_type: 'refresh_token',
      redirect_uri: redirectUri!,
    });

    let response;
    try {
      response = await axios.post(tokenUri, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });
    } catch (e) {
      console.log(e);
      throw e;
    }

    return {
      oauth_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
    };
  }
}
