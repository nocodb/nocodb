import axios from 'axios';
import { Gitlab } from '@gitbeaker/rest';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, redirectUri, tokenUri } from './config';
import type { GitlabAuthConfig } from './types';
import type { TestConnectionResponse } from '@noco-integrations/core';

export class GitlabAuthIntegration extends AuthIntegration<
  GitlabAuthConfig,
  InstanceType<typeof Gitlab>
> {
  public async authenticate(): Promise<InstanceType<typeof Gitlab>> {
    const hostname = this.config.hostname || 'https://gitlab.com';

    switch (this.config.type) {
      case AuthType.ApiKey:
        this.client = new Gitlab({
          token: this.config.token,
          host: hostname,
        });
        break;

      case AuthType.OAuth:
        this.client = new Gitlab({
          oauthToken: this.config.oauth_token,
          host: hostname,
        });
        break;

      default:
        throw new Error(
          `Unsupported authentication type: ${(this.config as any).type}`,
        );
    }

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      await this.use(async (gitlab) => {
        await gitlab.Users.showCurrentUser();
      });

      return {
        success: true,
      };
    } catch (error: any) {
      if (error?.cause?.description?.includes('401')) {
        return {
          success: false,
          message: 'Invalid token or unauthorized access',
        };
      }

      if (error?.cause?.description?.includes('403')) {
        return {
          success: false,
          message: 'Access forbidden - check token permissions',
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async exchangeToken(payload: {
    code: string;
    code_verifier?: string;
  }): Promise<{ oauth_token: string; refresh_token: string }> {
    const { code, code_verifier } = payload;

    const params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri!,
    });

    if (code_verifier) {
      params.append('code_verifier', code_verifier);
    }

    try {
      const response = await axios.post(tokenUri, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      return {
        oauth_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to exchange GitLab token: ${message}`);
    }
  }

  public async refreshToken(payload: {
    refresh_token: string;
  }): Promise<{ oauth_token: string; refresh_token: string }> {
    const params = new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: payload.refresh_token,
      grant_type: 'refresh_token',
      redirect_uri: redirectUri!,
    });

    try {
      const response = await axios.post(tokenUri, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      return {
        oauth_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to refresh GitLab token: ${message}`);
    }
  }

  /**
   * Override to detect GitLab-specific token expiration errors
   */
  protected shouldRefreshToken(err: any): boolean {
    const config = this.config as any;

    // Only refresh for OAuth configurations with refresh tokens
    if (config.type !== AuthType.OAuth || !config.refresh_token) {
      return false;
    }

    // GitLab returns 401 in the cause description
    if (err?.cause?.description?.includes('401')) {
      return true;
    }

    // Fall back to base class logic
    return super.shouldRefreshToken(err);
  }
}
