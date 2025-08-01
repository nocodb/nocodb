import ModelXcMetaMysql from './ModelXcMetaMysql';
import ModelXcMetaOracle from './ModelXcMetaOracle';
import ModelXcMetaPg from './ModelXcMetaPg';
import ModelXcMetaSqlite from './ModelXcMetaSqlite';
import ModelXcMetaSnowflake from './ModelXcMetaSnowflake';
import ModelXcMetaDatabricks from './ModelXcMetaDatabricks';
import type BaseModelXcMeta from './BaseModelXcMeta';

class ModelXcMetaFactory {
  public static create(connectionConfig, args): BaseModelXcMeta {
    if (
      connectionConfig.client === 'mysql2' ||
      connectionConfig.client === 'mysql'
    ) {
      return new ModelXcMetaMysql(args);
    } else if (connectionConfig.client === 'sqlite3') {
      return new ModelXcMetaSqlite(args);
    } else if (connectionConfig.client === 'pg') {
      return new ModelXcMetaPg(args);
    } else if (connectionConfig.client === 'oracledb') {
      return new ModelXcMetaOracle(args);
    } else if (connectionConfig.client === 'snowflake') {
      return new ModelXcMetaSnowflake(args);
    } else if (connectionConfig.client === 'databricks') {
      return new ModelXcMetaDatabricks(args);
    }

    throw new Error('Database not supported');
  }
}

export default ModelXcMetaFactory;
