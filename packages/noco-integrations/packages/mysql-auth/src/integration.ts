import { knex } from 'knex';
import { AuthIntegration } from '@noco-integrations/core';
import type { MySQLAuthConfig } from './types';
import type { Knex } from 'knex';
import type { TestConnectionResponse } from '@noco-integrations/core';

export class MySQLAuthIntegration extends AuthIntegration<
  MySQLAuthConfig,
  Knex
> {
  public async authenticate(): Promise<Knex> {
    const knexConfig: Knex.Config = {
      client: 'mysql2',
      connection: {
        host: this.config.host,
        port: this.config.port || 3306,
        user: this.config.username,
        password: this.config.password,
      },
      pool: {
        min: 1,
        max: 1,
      },
    };

    // Handle SSL configuration
    if (this.config.ssl) {
      (knexConfig.connection as any).ssl =
        this.config.ssl === 'true' ? true : { rejectUnauthorized: false };
    }

    this.client = knex(knexConfig);

    return this.client;
  }

  public async testConnection(): Promise<TestConnectionResponse> {
    try {
      await this.use(async (client) => {
        await client.raw('SELECT 1');
      });

      return {
        success: true,
      };
    } catch (error: any) {
      if (error?.errno === 1045) {
        return {
          success: false,
          message: 'Authentication failed - invalid credentials',
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async destroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
        this.client = null;
      } catch (error) {
        console.warn('Error while destroying MySQL connection:', error);
      }
    }
  }
}
