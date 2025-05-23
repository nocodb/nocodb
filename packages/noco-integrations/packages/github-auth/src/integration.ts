import { Octokit } from 'octokit';
import axios from 'axios';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, tokenUri } from './config';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class GithubAuthIntegration extends AuthIntegration {
  public client: Octokit | null = null;

  public async authenticate(): Promise<AuthResponse<Octokit>> {
    switch (this.config.type) {
      case AuthType.ApiKey:
        this.client = new Octokit({
          auth: this.config.token,
        });

        return this.client;
      case AuthType.OAuth:
        this.client = new Octokit({
          auth: this.config.oauth_token,
        });

        return this.client;
      default:
        throw new Error('Not implemented');
    }
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const octokit = await this.authenticate();

      if (!octokit) {
        return {
          success: false,
          message: 'Missing GitHub Octokit client',
        };
      }

      // Test connection by fetching the authenticated user
      await octokit.rest.users.getAuthenticated();
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
