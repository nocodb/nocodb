import { type ClickHouseClient, createClient } from '@clickhouse/client';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class ClickhouseAuthIntegration extends AuthIntegration {
  public client: ClickHouseClient | null = null;

  public async authenticate(): Promise<AuthResponse<ClickHouseClient>> {
    switch (this.config.type) {
      case AuthType.Custom:
        this.client = createClient({
            host: this.config.host,
            username: this.config.username,
            password: this.config.password,
            database: this.config.database,
          });

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
