import axios from 'axios';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

interface ZendeskClient {
  subdomain: string;
  token: string;
  email?: string;
  apiVersion: string;
}

export class ZendeskAuthIntegration extends AuthIntegration {
  public client: ZendeskClient | null = null;

  public async authenticate(): Promise<AuthResponse<ZendeskClient>> {
    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.subdomain || !this.config.email || !this.config.token) {
          throw new Error('Missing required Zendesk configuration');
        }

        this.client = {
          subdomain: this.config.subdomain,
          email: this.config.email,
          token: this.config.token,
          apiVersion: 'v2',
        };

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
          message: 'Missing Zendesk client',
        };
      }

      // Test connection by fetching current user information
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.type === AuthType.ApiKey) {
        const auth = Buffer.from(
          `${client.email}/token:${client.token}`,
        ).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const response = await axios.get(
        `https://${client.subdomain}.zendesk.com/api/v2/users/me.json`,
        { headers },
      );

      if (response.data && response.data.user) {
        return {
          success: true,
        };
      }

      return {
        success: false,
        message: 'Failed to verify Zendesk connection',
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
    throw new Error('Not implemented');
  }
}
