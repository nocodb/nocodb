import axios, { type AxiosInstance } from 'axios';
import { AuthIntegration } from '@noco-integrations/core';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class ChatwootAuthIntegration extends AuthIntegration {
  public client: AxiosInstance | null = null;

  public async authenticate(): Promise<AuthResponse<AxiosInstance>> {
    if (!this.config.chatwoot_url || !this.config.account_id || !this.config.api_token) {
      throw new Error('Missing required Chatwoot configuration');
    }

    const baseURL = this.config.chatwoot_url.replace(/\/$/, '');

    this.client = axios.create({
      baseURL: `${baseURL}/api/v1/accounts/${this.config.account_id}`,
      headers: {
        'api_access_token': this.config.api_token,
        'Content-Type': 'application/json',
      },
    });

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const client = await this.authenticate();

      if (!client) {
        return {
          success: false,
          message: 'Missing Chatwoot client',
        };
      }

      // Test connection by fetching conversation counts
      await client.get('/conversations/meta');

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
}