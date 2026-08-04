import { ClientType } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { DBQueryClient as DBQueryClientType } from '~/dbQueryClient/types';
import { DriverClient } from '~/utils/nc-config';
import { PGDBQueryClient } from '~/dbQueryClient/pg';
import { MySqlDBQueryClient } from '~/dbQueryClient/mysql';
import { SqliteDBQueryClient } from '~/dbQueryClient/sqlite';
import { MssqlDBQueryClient } from '~/dbQueryClient/mssql';
import { OracleDBQueryClient } from '~/dbQueryClient/oracle';

export class DBQueryClient {
  static get(
    clientType: ClientType | DriverClient,
    dbVersion?: string,
  ): DBQueryClientType {
    let client: DBQueryClientType;
    switch (clientType) {
      case ClientType.PG: {
        client = new PGDBQueryClient();
        break;
      }
      case ClientType.MYSQL:
      // eslint-disable-next-line no-fallthrough
      case DriverClient.MYSQL_LEGACY: {
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
      case ClientType.ORACLE: {
        client = new OracleDBQueryClient();
        break;
      }
    }
    if (client) {
      client.dbVersion = dbVersion;
    }
    return client;
  }

  static fromKnex(knex: Knex, dbVersion?: string): DBQueryClientType {
    const cfgClient = knex.client?.config?.client as any;
    const c: string =
      typeof cfgClient === 'string'
        ? cfgClient
        : cfgClient?.prototype?.dialect || cfgClient?.prototype?.driverName;
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
      case 'oracledb':
        return DBQueryClient.get(ClientType.ORACLE, dbVersion);
      default:
        throw new Error(`DBQueryClient: unsupported knex client '${c}'`);
    }
  }
}
