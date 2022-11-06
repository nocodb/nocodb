import knex from './sql/CustomKnex';

export class DbFactory {
  static create(connectionConfig) {
    if (connectionConfig.client === 'sqlite3' || connectionConfig.client === 'better-sqlite3') {
      connectionConfig.connection.client = connectionConfig.connection.client === 'sqlite3' ? 'better-sqlite3' : connectionConfig.connection.client;
      return knex(connectionConfig.connection);
    } else if (
      ['mysql', 'mysql2', 'pg', 'mssql'].includes(connectionConfig.client)
    ) {
      return knex(connectionConfig);
    }
    throw new Error('Database not supported');
  }
}
