import { type ClickHouseClient, createClient } from '@clickhouse/client';
import { AuthIntegration, AuthType } from '@noco-integrations/core';
import type { AuthCredentials, AuthResponse } from '@noco-integrations/core';

export class ClickhouseAuthIntegration extends AuthIntegration {
  public async authenticate(): Promise<AuthResponse<ClickHouseClient>> {
    switch (this.config.type) {
      case AuthType.Custom:
        return {
          custom: createClient({
            host: this.config.host,
            username: this.config.username,
            password: this.config.password,
            database: this.config.database,
          }),
        };
      default:
        throw new Error('Not implemented');
    }
  }
}
