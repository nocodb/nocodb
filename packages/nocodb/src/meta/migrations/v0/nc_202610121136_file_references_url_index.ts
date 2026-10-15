import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const INDEX_NAME = 'nc_fr_file_url';

// Ownership checks look a ref up by file_url on every attachment write and external-source read.
const up = async (knex: Knex) => {
  const client = knex.client.config.client;

  if (client === 'pg' || client === 'postgresql') {
    // Large installs build it CONCURRENTLY ahead of the deploy; a failed build leaves it invalid.
    const { rows } = await knex.raw(
      'SELECT i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ? AND i.indrelid = to_regclass(?)',
      [INDEX_NAME, MetaTable.FILE_REFERENCES],
    );
    if (rows[0]?.indisvalid) return;
    if (rows.length) await knex.raw('DROP INDEX ??', [INDEX_NAME]);

    // Hash takes urls of any length.
    await knex.raw('CREATE INDEX ?? ON ?? USING hash (??)', [
      INDEX_NAME,
      MetaTable.FILE_REFERENCES,
      'file_url',
    ]);
  } else if (client.includes('mysql')) {
    // 191 characters stay within the 767-byte utf8mb4 key limit of older row formats.
    await knex.raw('CREATE INDEX ?? ON ?? (??(191))', [
      INDEX_NAME,
      MetaTable.FILE_REFERENCES,
      'file_url',
    ]);
  } else {
    await knex.raw('CREATE INDEX ?? ON ?? (??)', [
      INDEX_NAME,
      MetaTable.FILE_REFERENCES,
      'file_url',
    ]);
  }
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.dropIndex('file_url', INDEX_NAME);
  });
};

export { up, down };
