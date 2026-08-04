import { NcError } from '~/helpers/ncError';
import { resolveSslFileConfig } from '~/helpers/resolveSslFileConfig';
import MySqlClient from '~/db/sql-client/lib/mysql/MysqlClient';
import SqliteClient from '~/db/sql-client/lib/sqlite/SqliteClient';
import PgClient from '~/db/sql-client/lib/pg/PgClient';
import YugabyteClient from '~/db/sql-client/lib/pg/YugabyteClient';
import TidbClient from '~/db/sql-client/lib/mysql/TidbClient';
import VitessClient from '~/db/sql-client/lib/mysql/VitessClient';

export class SqlClientFactory {
  static create(connectionConfig): any {
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
    } else if (connectionConfig.client === 'pg') {
      if (connectionConfig.meta.dbtype === 'yugabyte')
        return new YugabyteClient(connectionConfig);
      return new PgClient(connectionConfig);
    }

    NcError.notImplemented(
      `Database ${connectionConfig?.meta?.dbtype || ''} is not supported`,
    );
  }
}

export default class {
  static async create(connectionConfig) {
    await resolveSslFileConfig(connectionConfig);

    return SqlClientFactory.create(connectionConfig);
  }
}
