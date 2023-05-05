import { SnowflakeClient } from 'nc-help';
import { SqlClientFactory } from '../SqlClientFactory';
import SfClient from '../snowflake/SnowflakeClient';

class SqlClientFactoryEE {
  static create(connectionConfig) {
    connectionConfig.meta = connectionConfig.meta || {};
    connectionConfig.pool = connectionConfig.pool || { min: 0, max: 5 };
    connectionConfig.meta.dbtype = connectionConfig.meta.dbtype || '';

    if (connectionConfig.client === 'snowflake') {
      connectionConfig.client = SnowflakeClient;
      return new SfClient(connectionConfig);
    }
    return SqlClientFactory.create(connectionConfig);
  }
}

export default SqlClientFactoryEE;
