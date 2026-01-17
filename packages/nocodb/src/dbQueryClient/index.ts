import { ClientType } from 'nocodb-sdk';
import type { DBQueryClient as DBQueryClientType } from '~/dbQueryClient/types';
import { PGDBQueryClient } from '~/dbQueryClient/pg';
import { MySqlDBQueryClient } from '~/dbQueryClient/mysql';
import { SqliteDBQueryClient } from '~/dbQueryClient/sqlite';

export class DBQueryClient {
  static get(clientType: ClientType): DBQueryClientType {
    switch (clientType) {
      case ClientType.PG: {
        return new PGDBQueryClient();
      }
      case ClientType.MYSQL: {
        return new MySqlDBQueryClient();
      }
      case ClientType.SQLITE: {
        return new SqliteDBQueryClient();
      }
    }
  }
}
