import { knex } from 'knex';
import { AuthIntegration } from '@noco-integrations/core';
import type { Knex } from 'knex';
import type {
  AuthResponse,
  TestConnectionResponse,
} from '@noco-integrations/core';

export class PostgresAuthIntegration extends AuthIntegration {
  public client: Knex | null = null;

  public async authenticate(): Promise<AuthResponse<Knex>> {
    const knexConfig: Knex.Config = {
      client: 'pg',
      connection: {
        host: this.config.host,
        port: this.config.port || 5432,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
      },
      pool: {
        min: 1,
        max: 1,
      },
    };

    if (this.config.ssl) {
      (knexConfig.connection as any).ssl =
        this.config.ssl === 'true' ? true : { rejectUnauthorized: false };
    }

    this.client = knex(knexConfig);

    return this.client;
  }

  public async destroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
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
          message: 'Missing PostgreSQL client',
        };
      }

      // Attempt to execute a simple query
      await client.raw('SELECT 1');

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      // Close the connection
      try {
        const client = await this.authenticate();
        if (client) {
          await client.destroy();
        }
      } catch {
        // Ignore errors when closing connection
      }
    }
  }
}
