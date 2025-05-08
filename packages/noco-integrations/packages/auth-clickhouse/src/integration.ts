import { type ClickHouseClient, createClient } from '@clickhouse/client';
import {
  AuthCredentials,
  AuthIntegration,
  AuthResponse,
  AuthType,
} from '@noco-integrations/core';

export class ClickhouseAuthIntegration extends AuthIntegration {
  public async authenticate(
    payload: AuthCredentials,
  ): Promise<AuthResponse<ClickHouseClient>> {
    switch (payload.type) {
      case AuthType.Custom:
        return {
          custom: createClient({
            host: payload.host,
            username: payload.username,
            password: payload.password,
            database: payload.database,
          }),
        };
      default:
        throw new Error('Not implemented');
    }
  }
}
