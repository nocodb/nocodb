import knex from 'knex'; //'./sql/CustomKnex';

export class DbFactory {
  static create(connectionConfig) {
    if (connectionConfig.client === 'sqlite3') {
      return knex(connectionConfig.connection);
    } else if (
      ['mysql', 'mysql2', 'pg', 'mssql'].includes(connectionConfig.client)
    ) {
      return knex(connectionConfig);
    }
    throw new Error('Database not supported');
  }
}
