import fs from 'fs';
import { promisify } from 'util';
import { SqlClientFactory as SqlClientFactoryCE } from 'src/db/sql-client/lib/SqlClientFactory';
import { SnowflakeClient } from 'knex-snowflake';
import SfClient from '~/db/sql-client/lib/snowflake/SnowflakeClient';

export class SqlClientFactory extends SqlClientFactoryCE {
  static create(connectionConfig) {
    connectionConfig.meta = connectionConfig.meta || {};
    connectionConfig.pool = connectionConfig.pool || { min: 0, max: 5 };
    connectionConfig.meta.dbtype = connectionConfig.meta.dbtype || '';

    if (connectionConfig.client === 'snowflake') {
      connectionConfig.client = SnowflakeClient;
      return new SfClient(connectionConfig);
    }
    return super.create(connectionConfig);
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

    return SqlClientFactory.create(connectionConfig);
  }
}
