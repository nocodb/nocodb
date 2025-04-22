import { type ClickHouseClient, createClient } from '@clickhouse/client';
import {
  type AuthCredentials,
  type AuthResponse,
  AuthType,
} from '~/integrations/auth/auth.helpers';
import AuthIntegration from '~/integrations/auth/auth.interface';

export default class ClickhouseAuthIntegration extends AuthIntegration {
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
