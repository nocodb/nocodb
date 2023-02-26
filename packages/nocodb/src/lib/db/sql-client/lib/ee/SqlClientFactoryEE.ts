import OracleClient from '../oracle/OracleClient'
import { SqlClientFactory } from '../SqlClientFactory';
import SfClient from '../snowflake/SnowflakeClient';
import { SnowflakeClient } from 'nc-help';

class SqlClientFactoryEE {
  static create(connectionConfig) {
    connectionConfig.meta = connectionConfig.meta || {};
    connectionConfig.pool = connectionConfig.pool || { min: 0, max: 5 };
    connectionConfig.meta.dbtype = connectionConfig.meta.dbtype || '';

    if (connectionConfig.client === 'snowflake') {
      connectionConfig.client = SnowflakeClient;
      return new SfClient(connectionConfig);
    } else if (connectionConfig.client === 'oracledb') {
      return new OracleClient(connectionConfig);
    }
    return SqlClientFactory.create(connectionConfig);
  }
}

export default SqlClientFactoryEE;
