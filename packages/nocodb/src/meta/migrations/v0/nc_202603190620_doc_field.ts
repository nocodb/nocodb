import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DOCS, (table) => {
    table.string('fk_column_id', 20).nullable();
    table.string('fk_row_id').nullable();
    table.string('doc_source').nullable().defaultTo('sidebar');

    table.index(
      ['base_id', 'fk_column_id', 'fk_row_id'],
      'nc_docs_v2_field_row_idx',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DOCS, (table) => {
    table.dropIndex(
      ['base_id', 'fk_column_id', 'fk_row_id'],
      'nc_docs_v2_field_row_idx',
    );
    table.dropColumn('fk_column_id');
    table.dropColumn('fk_row_id');
    table.dropColumn('doc_source');
  });
};

export { up, down };
