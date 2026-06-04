import { SqlClientFactory as SqlClientFactoryCE } from 'src/db/sql-client/lib/SqlClientFactory';
import { SnowflakeClient } from 'knex-snowflake';
import { DatabricksClient } from 'knex-databricks';
import SfClient from '~/db/sql-client/lib/snowflake/SnowflakeClient';
import DbClient from '~/db/sql-client/lib/databricks/DatabricksClient';
import MssqlClient from '~/db/sql-client/lib/mssql/MssqlClient';
import { resolveSslFileConfig } from '~/helpers/resolveSslFileConfig';

export class SqlClientFactory extends SqlClientFactoryCE {
  static create(connectionConfig) {
    connectionConfig.meta = connectionConfig.meta || {};
    connectionConfig.pool = connectionConfig.pool || { min: 0, max: 5 };
    connectionConfig.meta.dbtype = connectionConfig.meta.dbtype || '';

    if (connectionConfig.client === 'snowflake') {
      connectionConfig.client = SnowflakeClient;
      return new SfClient(connectionConfig);
    } else if (connectionConfig.client === 'databricks') {
      connectionConfig.client = DatabricksClient;
      return new DbClient(connectionConfig);
    } else if (connectionConfig.client === 'mssql') {
      return new MssqlClient(connectionConfig);
    }
    return super.create(connectionConfig);
  }
}

export default class {
  static async create(connectionConfig) {
    await resolveSslFileConfig(connectionConfig);

    return SqlClientFactory.create(connectionConfig);
  }
}
