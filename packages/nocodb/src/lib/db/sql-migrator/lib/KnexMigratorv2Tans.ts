/**
 * Class to create an instance of KnexMigrator
 *
 * @class KnexMigrator
 * @extends {SqlMigrator}
 */
import KnexMigratorv2 from './KnexMigratorv2';
import Base from '../../../models/Base';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import Noco from '../../../Noco';
import { XKnex } from '../../sql-data-mapper';
import NcMetaIO from '../../../meta/NcMetaIO';

import type MssqlClient from '../../sql-client/lib/mssql/MssqlClient';
import type MysqlClient from '../../sql-client/lib/mysql/MysqlClient';
import type OracleClient from '../../sql-client/lib/oracle/OracleClient';
import type PGClient from '../../sql-client/lib/pg/PgClient';
import type SnowflakeClient from '../../sql-client/lib/snowflake/SnowflakeClient';
import type SqliteClient from '../../sql-client/lib/sqlite/SqliteClient';

export default class KnexMigratorv2Tans extends KnexMigratorv2 {
  protected sqlClient: any;
  protected ncMeta: NcMetaIO;

  constructor(project: { id: string }, sqlClient = null, ncMeta = Noco.ncMeta) {
    super(project);
    this.sqlClient = sqlClient;
    this.ncMeta = ncMeta;
  }

  protected get metaDb(): XKnex {
    return this.ncMeta.knex || Noco.ncMeta.knex;
  }
  protected async getSqlClient(base: Base): Promise<SnowflakeClient | MysqlClient | SqliteClient | MssqlClient | OracleClient | PGClient> {
    return this.sqlClient || NcConnectionMgrv2.getSqlClient(base);
  }
}
