import { knex } from 'knex';
import { AuthIntegration } from '@noco-integrations/core';
import type { MssqlAuthConfig } from './types';
import type { Knex } from 'knex';
import type { TestConnectionResponse } from '@noco-integrations/core';

const toBool = (
  value: string | boolean | undefined,
  fallback: boolean,
): boolean => {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true';
};

// The form sends `port` as a string, but tedious requires a number for
// `config.options.port` and rejects strings outright.
const toPort = (value: string | number | undefined, fallback: number): number => {
  const port = Number(value);
  return Number.isFinite(port) && port > 0 ? port : fallback;
};

export class MssqlAuthIntegration extends AuthIntegration<
  MssqlAuthConfig,
  Knex
> {
  public async authenticate(): Promise<Knex> {
    const knexConfig: Knex.Config = {
      client: 'mssql',
      // knex's mssql dialect maps to the `tedious` driver, which expects
      // `server` (not `host`) and TLS settings under `options`.
      connection: {
        server: this.config.host,
        port: toPort(this.config.port, 1433),
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        options: {
          encrypt: toBool(this.config.encrypt, true),
          trustServerCertificate: toBool(
            this.config.trustServerCertificate,
            true,
          ),
        },
      } as any,
      pool: {
        min: 1,
        max: 1,
      },
    };

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
      // tedious surfaces connection/login failures via `code`.
      if (error?.code === 'ELOGIN') {
        return {
          success: false,
          message: 'Authentication failed - invalid username or password',
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

      if (error?.code === 'ETIMEOUT' || error?.code === 'ETIMEDOUT') {
        return {
          success: false,
          message: 'Connection timeout - check network connectivity',
        };
      }

      if (error?.code === 'ESOCKET') {
        return {
          success: false,
          message:
            'Connection failed - check host, port and that the server is reachable',
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
        console.warn('Error while destroying SQL Server connection:', error);
      }
    }
  }
}
