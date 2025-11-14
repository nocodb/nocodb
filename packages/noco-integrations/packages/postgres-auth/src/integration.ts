import { knex } from 'knex';
import { AuthIntegration } from '@noco-integrations/core';
import type { PostgresAuthConfig } from './types';
import type { Knex } from 'knex';
import type { TestConnectionResponse } from '@noco-integrations/core';

export class PostgresAuthIntegration extends AuthIntegration<
  PostgresAuthConfig,
  Knex
> {
  public async authenticate(): Promise<Knex> {
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

    // Handle SSL configuration
    if (this.config.ssl) {
      (knexConfig.connection as any).ssl =
        this.config.ssl === 'true' || this.config.ssl === true
          ? true
          : { rejectUnauthorized: false };
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
      // Handle specific PostgreSQL errors
      // Error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html

      if (error?.code === '28P01') {
        return {
          success: false,
          message: 'Authentication failed - invalid username or password',
        };
      }

      if (error?.code === '3D000') {
        return {
          success: false,
          message: 'Database not found - check database name',
        };
      }

      if (error?.code === '28000') {
        return {
          success: false,
          message: 'Authorization failed - check user permissions',
        };
      }

      if (error?.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: 'Connection refused - check host and port',
        };
      }

      if (error?.code === 'ENOTFOUND') {
        return {
          success: false,
          message: 'Host not found - check hostname',
        };
      }

      if (error?.code === 'ETIMEDOUT') {
        return {
          success: false,
          message: 'Connection timeout - check network connectivity',
        };
      }

      if (error?.code === 'ECONNRESET') {
        return {
          success: false,
          message: 'Connection reset - check firewall and network',
        };
      }

      if (error?.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        return {
          success: false,
          message:
            'Self-signed certificate - set ssl to false or provide valid certificate',
        };
      }

      if (error?.code === 'CERT_HAS_EXPIRED') {
        return {
          success: false,
          message: 'SSL certificate has expired',
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
        console.warn('Error while destroying PostgreSQL connection:', error);
      }
    }
  }
}
