import {
  AuthIntegration,
  AuthType,
  createAxiosInstance,
} from '@noco-integrations/core';
import axios from 'axios';
import {
  clientId,
  clientSecret,
  cloudUrlFormat,
  redirectUri,
  tokenUri,
} from './config';
import type { AxiosInstance } from 'axios';
import type { AtlassianAccessibleResource, JiraAuthConfig } from './types';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class JiraAuthIntegration extends AuthIntegration<
  JiraAuthConfig,
  AxiosInstance
> {
  // TODO: rate limit jira https://developer.atlassian.com/cloud/jira/platform/rate-limiting/#rate-limit-detection

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
      case AuthType.OAuth: {
        if (!this.config.jira_domain || !this.config.oauth_token) {
          throw new Error('Missing required Jira configuration');
        }
        const configVars = (await this.getVars()) ?? {};
        if (!configVars.cloud_id) {
          const { data: accessibleResources } = (await axios.get(
            'https://api.atlassian.com/oauth/token/accessible-resources',
            {
              headers: {
                Authorization: `Bearer ${this.config.oauth_token}`,
              },
            },
          )) as { data: AtlassianAccessibleResource[] };
          const selectedDomain = accessibleResources.find(
            (resource) =>
              resource.url ===
              cloudUrlFormat.replace('{MY_DOMAIN}', this.config.jira_domain!),
          );
          if (!selectedDomain) {
            throw new Error(
              'Jira URL does not seem to be accessible from user. Please ensure that the domain is in this format: https://{MY_COMPANY_NAME}.atlassian.net',
            );
          }
          configVars.cloud_id = selectedDomain.id;
          await this.saveVars(configVars);
        }

        this.client = createAxiosInstance(
          {
            baseURL: `https://api.atlassian.com/ex/jira/${configVars.cloud_id}/rest/api/3`,
            headers: {
              Authorization: `Bearer ${this.config.oauth_token}`,
              'Content-Type': 'application/json',
            },
          },
          this.getRateLimitConfig(),
        );

        return this.client;
      }
      default:
        throw new Error('Not implemented');
    }
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const client = await this.authenticate();
      // try to verify jira url
      new URL(this._config.jira_url!);

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

  public async exchangeToken(payload: { code: string; code_verifier: string }) {
    const response = await axios.post(
      tokenUri,
      {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: payload.code,
        redirect_uri: redirectUri,
        code_verifier: payload.code_verifier,
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
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    };
  }

  public async refreshToken(payload: { refresh_token: string }): Promise<{
    oauth_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const response = await axios.post(
      tokenUri,
      {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: payload.refresh_token,
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
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    };
  }

  protected shouldRefreshToken(err: any): boolean {
    const config = this.config as any;

    // Only refresh for OAuth configurations with refresh tokens
    if (config.type !== AuthType.OAuth || !config.refresh_token) {
      return false;
    }

    // Zoho returns 401 for expired tokens
    const status = err?.response?.status;
    if (status === 401) {
      return true;
    }

    // Fall back to base class logic
    return super.shouldRefreshToken(err);
  }
}
