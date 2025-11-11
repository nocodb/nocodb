import { AuthIntegration, createAxiosInstance } from '@noco-integrations/core';
import type { ChatwootAuthConfig } from './types'
import type {  AxiosInstance } from 'axios';
import type {
  RateLimitOptions,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class ChatwootAuthIntegration extends AuthIntegration<ChatwootAuthConfig, AxiosInstance> {
  public client: AxiosInstance | null = null;

  /**
   * Chatwoot rate limit: 100 requests per 15 seconds per account
   * Using conservative limits to avoid hitting the cap
   */
  protected getRateLimitConfig(): RateLimitOptions | null {
    return {
      global: {
        maxRequests: 90, // 90% of limit for safety
        perMilliseconds: 15 * 1000, // 15 seconds
      },
      maxQueueSize: 50,
    };
  }

  public async authenticate(): Promise<AxiosInstance> {
    if (!this.config.chatwoot_url || !this.config.account_id || !this.config.api_token) {
      throw new Error('Missing required Chatwoot configuration');
    }

    const baseURL = this.config.chatwoot_url.replace(/\/$/, '');
    
    this.client = createAxiosInstance(
      {
        baseURL: `${baseURL}/api/v1/accounts/${this.config.account_id}`,
        headers: {
          'api_access_token': this.config.api_token,
          'Content-Type': 'application/json',
        },
      },
      this.getRateLimitConfig(),
    );

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

      await this.use(async (client) => {
        await client.get('/conversations/meta');
      });

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