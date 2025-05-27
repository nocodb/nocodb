import { type ClickHouseClient, createClient } from '@clickhouse/client';
import { AuthIntegration } from '@noco-integrations/core';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class ClickhouseAuthIntegration extends AuthIntegration {
  public client: ClickHouseClient | null = null;

  public async authenticate(): Promise<AuthResponse<ClickHouseClient>> {
    this.client = createClient({
      url: this.config.url,
      username: this.config.username,
      password: this.config.password,
    });

    return this.client;
  }

  public async destroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore errors when closing connection
      }
    }
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      const client = await this.authenticate();

      if (!client) {
        return {
          success: false,
          message: 'Missing ClickHouse client',
        };
      }

      // Attempt to ping or execute a simple query
      await client.query({
        query: 'SELECT 1',
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
