import {
  AuthIntegration,
  AuthType,
  createAxiosInstance,
} from '@noco-integrations/core';
import type { AxiosInstance } from 'axios';
import type { JiraAuthConfig } from './types';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class JiraAuthIntegration extends AuthIntegration<
  JiraAuthConfig,
  AxiosInstance
> {
  public async authenticate(): Promise<AuthResponse<AxiosInstance>> {
    switch (this.config.type) {
      case AuthType.ApiKey: {
        if (!this.config.jira_url || !this.config.email || !this.config.token) {
          throw new Error('Missing required Jira configuration');
        }

        this.client = createAxiosInstance(
          {
            baseURL: `${this.config.jira_url}/rest/api/3`,
            auth: {
              username: this.config.email,
              password: this.config.token,
            },
            headers: {
              Accept: 'application/json',
            },
          },
          this.getRateLimitConfig(),
        );

        return this.client;
      }
      // case AuthType.OAuth:
      //   if (!this.config.jira_url || !this.config.oauth_token) {
      //     throw new Error('Missing required Jira configuration');
      //   }

      //   this.client = createAxiosInstance(
      //     {
      //       baseURL: `${this.config.jira_url}`,
      //       headers: {
      //         Authorization: `Bearer ${this.config.oauth_token}`,
      //         'Content-Type': 'application/json',
      //       },
      //     },
      //     this.getRateLimitConfig(),
      //   );

      //   return this.client;
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
          message: 'Missing Jira client',
        };
      }

      // Test connection by fetching current user information
      await client.get('/myself');
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

  // public async exchangeToken(payload: { code: string; code_verifier: string }) {
  //   const response = await axios.post(
  //     tokenUri,
  //     {
  //       grant_type: 'authorization_code',
  //       client_id: clientId,
  //       client_secret: clientSecret,
  //       code: payload.code,
  //       redirect_uri: redirectUri,
  //       code_verifier: payload.code_verifier,
  //     },
  //     {
  //       headers: {
  //         'Content-Type': 'application/json',
  //         Accept: 'application/json',
  //       },
  //     },
  //   );
  //   console.log('response.data', response.data);
  //   return {
  //     oauth_token: response.data.access_token,
  //     refresh_token: response.data.refresh_token,
  //     expires_in: response.data.expires_in,
  //   };
  // }

  private extractPartFromUrl(url: string) {
    try {
      const { hostname, protocol } = new URL(url);
      return { hostname, protocol };
    } catch {
      return { hostname: url, protocol: 'https' };
    }
  }
}
