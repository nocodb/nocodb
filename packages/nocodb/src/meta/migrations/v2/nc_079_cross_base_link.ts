import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.string('fk_related_base_id', 20);
    table.string('fk_mm_base_id', 20);
    table.string('fk_related_source_id', 20);
    table.string('fk_mm_source_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.dropColumn('fk_related_base_id');
    table.dropColumn('fk_mm_base_id');
    table.dropColumn('fk_related_source_id');
    table.dropColumn('fk_mm_source_id');
  });
};

export { up, down };
