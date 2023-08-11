/**
 * Class to create an instance of KnexMigrator
 *
 * @class KnexMigrator
 * @extends {SqlMigrator}
 */
import KnexMigratorv2 from './KnexMigratorv2';
import type Base from '~/models/Base';
import type { XKnex } from '~/db/CustomKnex';
import type MssqlClient from '~/db/sql-client/lib/mssql/MssqlClient';
import type MysqlClient from '~/db/sql-client/lib/mysql/MysqlClient';
import type OracleClient from '~/db/sql-client/lib/oracle/OracleClient';
import type PGClient from '~/db/sql-client/lib/pg/PgClient';
import type SnowflakeClient from '~/db/sql-client/lib/snowflake/SnowflakeClient';
import type SqliteClient from '~/db/sql-client/lib/sqlite/SqliteClient';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

export default class KnexMigratorv2Tans extends KnexMigratorv2 {
  protected sqlClient: any;
  // todo: tobe changed
  protected ncMeta: any; // NcMetaIO;

  constructor(project: { id: string }, sqlClient = null, ncMeta = Noco.ncMeta) {
    super(project);
    this.sqlClient = sqlClient;
    this.ncMeta = ncMeta;
  }

  protected get metaDb(): XKnex {
    return this.ncMeta.knex || Noco.ncMeta.knex;
  }
  protected async getSqlClient(
    base: Base,
  ): Promise<
    | SnowflakeClient
    | MysqlClient
    | SqliteClient
    | MssqlClient
    | OracleClient
    | PGClient
  > {
    return this.sqlClient || NcConnectionMgrv2.getSqlClient(base);
  }
}
