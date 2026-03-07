import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.string('fk_doc_id', 20).nullable();
    table.string('anchor_id', 20).nullable();
    table.index(['fk_doc_id'], 'nc_comments_doc_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.dropIndex(['fk_doc_id'], 'nc_comments_doc_idx');
    table.dropColumn('fk_doc_id');
    table.dropColumn('anchor_id');
  });
};

export { up, down };
