import {
  down as down074,
  up as up074,
} from 'src/meta/migrations/v2/nc_074_missing_context_indexes';

import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await up074(knex);

  await knex.schema.alterTable(MetaTable.CUSTOM_URLS, (table) => {
    table.index('custom_path');
    table.index(['base_id', 'fk_workspace_id'], 'nc_custom_urls_context');
  });

  await knex.schema.alterTable(MetaTable.SNAPSHOT, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_snapshot_context');
  });
};

const down = async (knex) => {
  await down074(knex);

  await knex.schema.alterTable(MetaTable.CUSTOM_URLS, (table) => {
    table.dropIndex('custom_path');
    table.dropIndex(['base_id', 'fk_workspace_id'], 'nc_custom_urls_context');
  });

  await knex.schema.alterTable(MetaTable.SNAPSHOT, (table) => {
    table.dropIndex(['base_id', 'fk_workspace_id'], 'nc_snapshot_context');
  });
};

export { up, down };
