import axios from 'axios';
import JiraClient from 'jira-client';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, tokenUri } from './config';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class JiraAuthIntegration extends AuthIntegration {
  public async authenticate(): Promise<AuthResponse<JiraClient>> {
    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.jira_url || !this.config.email || !this.config.token) {
          throw new Error('Missing required Jira configuration');
        }

        return {
          custom: new JiraClient({
            protocol: 'https',
            host: this.extractHostFromUrl(this.config.jira_url),
            username: this.config.email,
            password: this.config.token,
            apiVersion: '3',
            strictSSL: true,
          }),
        };
      case AuthType.OAuth:
        if (!this.config.jira_url || !this.config.oauth_token) {
          throw new Error('Missing required Jira configuration');
        }

        return {
          custom: new JiraClient({
            protocol: 'https',
            host: this.extractHostFromUrl(this.config.jira_url),
            bearer: this.config.oauth_token,
            apiVersion: '3',
            strictSSL: true,
          }),
        };
      default:
        throw new Error('Not implemented');
    }
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const jira = (await this.authenticate()).custom;

      if (!jira) {
        return {
          success: false,
          message: 'Missing Jira client',
        };
      }

      // Test connection by fetching current user information
      await jira.getCurrentUser();
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
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: payload.code,
        redirect_uri: this.config.redirect_uri,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
    };
  }

  private extractHostFromUrl(url: string): string {
    try {
      const { hostname } = new URL(url);
      return hostname;
    } catch {
      return url;
    }
  }
}
