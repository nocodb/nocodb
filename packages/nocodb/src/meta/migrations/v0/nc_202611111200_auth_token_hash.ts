import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Filled for new tokens on write and for older rows by nc_job_022; the clear
// columns stay until a later release.
const HASH_COLUMNS = [
  {
    table: MetaTable.USER_REFRESH_TOKENS,
    column: 'token_hash',
    index: 'nc_user_refresh_tokens_token_hash_idx',
  },
  {
    table: MetaTable.OAUTH_TOKENS,
    column: 'access_token_hash',
    index: 'nc_oauth_tokens_access_token_hash_idx',
  },
  {
    table: MetaTable.OAUTH_TOKENS,
    column: 'refresh_token_hash',
    index: 'nc_oauth_tokens_refresh_token_hash_idx',
  },
];

const indexExists = async (knex: Knex, table: string, index: string) => {
  const client = String(knex.client.config.client);

  if (client.includes('mysql')) {
    const [rows] = await knex.raw(
      'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
      [table, index],
    );
    return rows.length > 0;
  }

  if (client === 'mssql') {
    const rows = await knex.raw(
      'SELECT 1 AS found FROM sys.indexes WHERE name = ? AND object_id = OBJECT_ID(?)',
      [index, table],
    );
    return rows.length > 0;
  }

  const rows = await knex.raw(
    "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?",
    [index],
  );
  return rows.length > 0;
};

const up = async (knex: Knex) => {
  const client = knex.client.config.client;
  const isPg = client === 'pg' || client === 'postgresql';

  for (const { table, column, index } of HASH_COLUMNS) {
    // Guarded so the columns can be added by hand ahead of a deploy.
    const exists = await knex.schema.hasColumn(table, column);

    if (!exists) {
      // Nullable, no default: metadata-only on PG, no table rewrite.
      await knex.schema.alterTable(table, (t) => {
        t.string(column, 64);
      });
    }

    if (isPg) {
      // A failed CONCURRENTLY build ahead of the deploy leaves the index invalid.
      const { rows } = await knex.raw(
        'SELECT i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ? AND i.indrelid = to_regclass(?)',
        [index, table],
      );
      if (rows[0]?.indisvalid) continue;
      if (rows.length) await knex.raw('DROP INDEX ??', [index]);

      // Partial: built over a column that is still all NULL, so the scan writes nothing.
      await knex.raw('CREATE INDEX ?? ON ?? (??) WHERE ?? IS NOT NULL', [
        index,
        table,
        column,
        column,
      ]);
    } else if (!(await indexExists(knex, table, index))) {
      // Checked on its own: the columns may predate this run (added by hand, or
      // committed by MySQL DDL before a failed attempt).
      await knex.schema.alterTable(table, (t) => {
        t.index([column], index);
      });
    }
  }
};

const down = async (knex: Knex) => {
  for (const { table, column, index } of [...HASH_COLUMNS].reverse()) {
    if (!(await knex.schema.hasColumn(table, column))) continue;
    await knex.schema.alterTable(table, (t) => {
      t.dropIndex([column], index);
      t.dropColumn(column);
    });
  }
};

export { up, down };
