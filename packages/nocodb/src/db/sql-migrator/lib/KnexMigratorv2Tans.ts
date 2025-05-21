/**
 * Class to create an instance of KnexMigrator
 *
 * @class KnexMigrator
 * @extends {SqlMigrator}
 */
import KnexMigratorv2 from './KnexMigratorv2';
import type Source from '~/models/Source';
import type { XKnex } from '~/db/CustomKnex';
import type MssqlClient from '~/db/sql-client/lib/mssql/MssqlClient';
import type MysqlClient from '~/db/sql-client/lib/mysql/MysqlClient';
import type OracleClient from '~/db/sql-client/lib/oracle/OracleClient';
import type PGClient from '~/db/sql-client/lib/pg/PgClient';
import type SqliteClient from '~/db/sql-client/lib/sqlite/SqliteClient';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

export default class KnexMigratorv2Tans extends KnexMigratorv2 {
  protected sqlClient: any;
  // todo: tobe changed
  protected ncMeta: any; // NcMetaIO;

  constructor(
    context: NcContext,
    base: { id: string },
    sqlClient = null,
    ncMeta = Noco.ncMeta,
  ) {
    super(context, base);
    this.sqlClient = sqlClient;
    this.ncMeta = ncMeta;
  }

  protected get metaDb(): XKnex {
    return this.ncMeta.knex || Noco.ncMeta.knex;
  }
  protected async getSqlClient(
    source: Source,
  ): Promise<
    MysqlClient | SqliteClient | MssqlClient | OracleClient | PGClient
  > {
    return this.sqlClient || NcConnectionMgrv2.getSqlClient(source);
  }
}
