import 'mocha';
import { expect } from 'chai';
import knexLib from 'knex';
import { PGDBQueryClient } from '~/dbQueryClient/pg';
import { SqliteDBQueryClient } from '~/dbQueryClient/sqlite';

// `replaceDelimitedWithKeyValue` maps a comma-delimited user-id cell to its
// display-name representation for User/CreatedBy/LastModifiedBy sort & filter.
// PG (string_agg) and SQLite (GROUP_CONCAT) re-aggregate the per-id rows, so
// the concatenation order MUST be pinned to the cell's stored position —
// otherwise the sortable value is non-deterministic and shifts whenever the
// base-user list (the key/value `stack`) changes size or order. The MySQL/MSSQL
// generic handler uses nested REPLACE() on the original string and is already
// order-preserving, so only PG/SQLite need the explicit ordering.

export function replaceDelimitedWithKeyValueTest() {
  describe('replaceDelimitedWithKeyValue — deterministic multi-user concat order', () => {
    // Two users whose display order must follow the cell, not the stack order.
    const stack = [
      { key: 'usr_a', value: 'Alice' },
      { key: 'usr_b', value: 'Bob' },
    ];

    it('PG: string_agg is ordered by the cell position', () => {
      const knex: any = knexLib({ client: 'pg' });

      const sql = new PGDBQueryClient().replaceDelimitedWithKeyValue({
        knex,
        stack,
        needleColumn: 'users_col',
      });

      expect(sql.toLowerCase()).to.match(/string_agg\(.*order by/s);
    });

    it('SQLite: group_concat is ordered by the cell position', () => {
      const knex: any = knexLib({ client: 'sqlite3', useNullAsDefault: true });

      const sql = new SqliteDBQueryClient().replaceDelimitedWithKeyValue({
        knex,
        stack,
        needleColumn: 'users_col',
      });

      expect(sql.toLowerCase()).to.match(/group_concat\(.*order by/s);
    });
  });
}
