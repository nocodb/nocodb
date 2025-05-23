import axios from 'axios';
import * as asana from 'asana';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import { clientId, clientSecret, tokenUri } from './config';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class AsanaAuthIntegration extends AuthIntegration {
  public client: asana.Client | null = null;

  public async authenticate(): Promise<AuthResponse<asana.Client>> {
    switch (this.config.type) {
      case AuthType.ApiKey:
        if (!this.config.token) {
          throw new Error('Missing required Asana API token');
        }

        this.client = asana.Client.create();
        this.client.useAccessToken(this.config.token);

        return this.client;
      case AuthType.OAuth:
        if (!this.config.oauth_token) {
          throw new Error('Missing required Asana OAuth token');
        }

        this.client = asana.Client.create();
        this.client.useAccessToken(this.config.oauth_token);

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
          message: 'Missing Asana client',
        };
      }

      // Test the connection by fetching the current user
      await client.users.me();
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
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      },
    );

    return {
      oauth_token: response.data.access_token,
    };
  }
}
