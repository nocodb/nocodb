import axios from 'axios';
import { Gitlab } from '@gitbeaker/rest';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, tokenUri } from './config';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class GitlabAuthIntegration extends AuthIntegration {
  public client: InstanceType<typeof Gitlab> | null = null;

  public async authenticate(): Promise<
    AuthResponse<InstanceType<typeof Gitlab>>
  > {
    switch (this.config.type) {
      case AuthType.ApiKey:
        this.client = new Gitlab({
          token: this.config.token,
        });

        return this.client;
      case AuthType.OAuth:
        this.client = new Gitlab({
          oauthToken: this.config.oauth_token,
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

      // Test connection by fetching the current user
      await gitlab.Users.all({ perPage: 1 });
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async exchangeToken(payload: {
    code: string;
  }): Promise<{ oauth_token: string }> {
    const response = await axios.post(
      tokenUri,
      {
        client_id: clientId,
        client_secret: clientSecret,
        code: payload.code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirect_uri,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
    };
  }
}
