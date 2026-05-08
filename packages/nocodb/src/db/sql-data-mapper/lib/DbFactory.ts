import knex from 'knex'; //'./sql/CustomKnex';
import { D1KnexClient } from '~/db/sql-client/lib/d1/D1KnexClient';

export class DbFactory {
  static create(connectionConfig) {
    if (connectionConfig.client === 'sqlite3') {
      return knex(connectionConfig.connection);
    } else if (connectionConfig.client === 'd1') {
      return knex({
        ...connectionConfig,
        client: D1KnexClient,
        useNullAsDefault: true,
      });
    } else if (['mysql', 'mysql2', 'pg'].includes(connectionConfig.client)) {
      return knex(connectionConfig);
    }
    throw new Error('Database not supported');
  }
}
