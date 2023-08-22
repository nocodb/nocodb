import GqlXcSchemaMssql from './GqlXcTsSchemaMssql';
import GqlXcTsSchemaMysql from './GqlXcTsSchemaMysql';
import GqlXcSchemaOracle from './GqlXcTsSchemaOracle';
import GqlXcSchemaPg from './GqlXcTsSchemaPg';
import GqlXcSchemaSqlite from './GqlXcTsSchemaSqlite';

class GqlXcSchemaFactory {
  public static create(connectionConfig, args): any {
    if (
      connectionConfig.client === 'mysql2' ||
      connectionConfig.client === 'mysql'
    ) {
      return new GqlXcTsSchemaMysql(args);
    } else if (connectionConfig.client === 'sqlite3') {
      return new GqlXcSchemaSqlite(args);
    } else if (connectionConfig.client === 'mssql') {
      return new GqlXcSchemaMssql(args);
    } else if (connectionConfig.client === 'pg') {
      return new GqlXcSchemaPg(args);
    } else if (connectionConfig.client === 'oracledb') {
      return new GqlXcSchemaOracle(args);
    }

    throw new Error('Database not supported');
  }
}

export default GqlXcSchemaFactory;
