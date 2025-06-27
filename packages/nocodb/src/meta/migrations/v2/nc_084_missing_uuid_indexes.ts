import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.index('uuid', 'idx_base_uuid');
  });

  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.index('uuid', 'idx_view_uuid');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropIndex('idx_project_uuid');
  });

  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.dropIndex('idx_view_uuid');
  });
};

export { up, down };
