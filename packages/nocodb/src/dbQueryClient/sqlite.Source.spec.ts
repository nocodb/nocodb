import knex from 'knex';
import { SqliteDBQueryClient } from './sqlite';

jest.mock('~/dbQueryClient/cross-db-utils/aggregate', () => ({
  aggregate: jest.fn(),
}));
jest.mock('~/dbQueryClient/cross-db-utils/bulk-aggregate', () => ({
  bulkAggregate: jest.fn(),
}));
jest.mock('~/dbQueryClient/aggregations', () => ({
  getAggregationHandler: jest.fn(),
}));

const SQLITE_CLIENT = 'sqlite3';
const SQLITE_MEMORY_CONNECTION = ':memory:';
const SQLITE_COMPOUND_SELECT_LIMIT_REGRESSION_ROWS = 600;
const TEMP_TABLE_ALIAS = '_tbl';
const TEMP_TABLE_FIELDS = ['_id', '_title'];

describe('SqliteDBQueryClient', () => {
  it('executes temporary table rows from sqlite', async () => {
    const db = knex({
      client: SQLITE_CLIENT,
      connection: { filename: SQLITE_MEMORY_CONNECTION },
      useNullAsDefault: true,
    });

    try {
      const client = new SqliteDBQueryClient();

      const rows = await db.select('*').from(
        client.temporaryTableRaw({
          knex: db as any,
          data: [{ _id: '26', _title: 'Tag' }],
          fields: TEMP_TABLE_FIELDS,
          alias: TEMP_TABLE_ALIAS,
        }),
      );

      expect(rows).toEqual([{ _id: '26', _title: 'Tag' }]);
    } finally {
      await db.destroy();
    }
  });

  it('executes temporary table rows above sqlite compound select limits', async () => {
    const db = knex({
      client: SQLITE_CLIENT,
      connection: { filename: SQLITE_MEMORY_CONNECTION },
      useNullAsDefault: true,
    });

    try {
      const client = new SqliteDBQueryClient();
      const data = Array.from(
        { length: SQLITE_COMPOUND_SELECT_LIMIT_REGRESSION_ROWS },
        (_, index) => ({
          _id: String(index + 1),
          _title: `Tag ${index + 1}`,
        }),
      );

      const rows = await db.count<{ total: number }[]>({ total: '*' }).from(
        client.temporaryTableRaw({
          knex: db as any,
          data,
          fields: TEMP_TABLE_FIELDS,
          alias: TEMP_TABLE_ALIAS,
        }),
      );

      expect(Number(rows[0].total)).toBe(
        SQLITE_COMPOUND_SELECT_LIMIT_REGRESSION_ROWS,
      );
    } finally {
      await db.destroy();
    }
  });
});
