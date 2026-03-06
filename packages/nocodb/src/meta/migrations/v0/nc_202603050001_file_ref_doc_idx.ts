import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.index(['base_id', 'fk_doc_id'], 'nc_fr_doc_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.dropIndex(['base_id', 'fk_doc_id'], 'nc_fr_doc_idx');
  });
};

export { up, down };
