import { ClientType } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { DBQueryClient as DBQueryClientType } from '~/dbQueryClient/types';
import { PGDBQueryClient } from '~/dbQueryClient/pg';
import { MySqlDBQueryClient } from '~/dbQueryClient/mysql';
import { SqliteDBQueryClient } from '~/dbQueryClient/sqlite';
import { MssqlDBQueryClient } from '~/dbQueryClient/mssql';

export class DBQueryClient {
  static get(clientType: ClientType, dbVersion?: string): DBQueryClientType {
    let client: DBQueryClientType;
    switch (clientType) {
      case ClientType.PG: {
        client = new PGDBQueryClient();
        break;
      }
      case ClientType.MYSQL: {
        client = new MySqlDBQueryClient();
        break;
      }
      case ClientType.SQLITE: {
        client = new SqliteDBQueryClient();
        break;
      }
      case ClientType.MSSQL: {
        client = new MssqlDBQueryClient();
        break;
      }
    }
    if (client) {
      client.dbVersion = dbVersion;
    }
    return client;
  }

  static fromKnex(knex: Knex, dbVersion?: string): DBQueryClientType {
    const c: string = knex.client.config.client;
    switch (c) {
      case 'pg':
        return DBQueryClient.get(ClientType.PG, dbVersion);
      case 'mysql':
      case 'mysql2':
        return DBQueryClient.get(ClientType.MYSQL, dbVersion);
      case 'sqlite3':
        return DBQueryClient.get(ClientType.SQLITE, dbVersion);
      case 'mssql':
        return DBQueryClient.get(ClientType.MSSQL, dbVersion);
      default:
        throw new Error(`DBQueryClient: unsupported knex client '${c}'`);
    }
  }
}
