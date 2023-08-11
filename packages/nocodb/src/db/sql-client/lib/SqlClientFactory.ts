import fs from 'fs';
import { promisify } from 'util';
import MySqlClient from '~/db/sql-client/lib/mysql/MysqlClient';
import MssqlClient from '~/db/sql-client/lib/mssql/MssqlClient';
import OracleClient from '~/db/sql-client/lib/oracle/OracleClient';
import SqliteClient from '~/db/sql-client/lib/sqlite/SqliteClient';
import PgClient from '~/db/sql-client/lib/pg/PgClient';
import YugabyteClient from '~/db/sql-client/lib/pg/YugabyteClient';
import TidbClient from '~/db/sql-client/lib/mysql/TidbClient';
import VitessClient from '~/db/sql-client/lib/mysql/VitessClient';

export class SqlClientFactory {
  static create(connectionConfig) {
    connectionConfig.meta = connectionConfig.meta || {};
    connectionConfig.pool = connectionConfig.pool || { min: 0, max: 5 };
    connectionConfig.meta.dbtype = connectionConfig.meta.dbtype || '';
    if (
      connectionConfig.client === 'mysql' ||
      connectionConfig.client === 'mysql2'
    ) {
      if (connectionConfig.meta.dbtype === 'tidb')
        return new TidbClient(connectionConfig);
      if (connectionConfig.meta.dbtype === 'vitess')
        return new VitessClient(connectionConfig);
      return new MySqlClient(connectionConfig);
    } else if (connectionConfig.client === 'sqlite3') {
      return new SqliteClient(connectionConfig);
    } else if (connectionConfig.client === 'mssql') {
      return new MssqlClient(connectionConfig);
    } else if (connectionConfig.client === 'oracledb') {
      return new OracleClient(connectionConfig);
    } else if (connectionConfig.client === 'pg') {
      if (connectionConfig.meta.dbtype === 'yugabyte')
        return new YugabyteClient(connectionConfig);
      return new PgClient(connectionConfig);
    }

    throw new Error('Database not supported');
  }
}

export default class {
  static async create(connectionConfig) {
    if (
      connectionConfig.connection.ssl &&
      typeof connectionConfig.connection.ssl === 'object'
    ) {
      if (connectionConfig.connection.ssl.caFilePath) {
        connectionConfig.connection.ssl.ca = (
          await promisify(fs.readFile)(
            connectionConfig.connection.ssl.caFilePath,
          )
        ).toString();
        delete connectionConfig.connection.ssl.caFilePath;
      }
      if (connectionConfig.connection.ssl.keyFilePath) {
        connectionConfig.connection.ssl.key = (
          await promisify(fs.readFile)(
            connectionConfig.connection.ssl.keyFilePath,
          )
        ).toString();
        delete connectionConfig.connection.ssl.keyFilePath;
      }
      if (connectionConfig.connection.ssl.certFilePath) {
        connectionConfig.connection.ssl.cert = (
          await promisify(fs.readFile)(
            connectionConfig.connection.ssl.certFilePath,
          )
        ).toString();
        delete connectionConfig.connection.ssl.certFilePath;
      }
    }

    // todo: tobe done
    // if (Noco.isEE()) {
    //   return SqlClientFactoryEE.create(connectionConfig);
    // }

    return SqlClientFactory.create(connectionConfig);
  }
}
