import type { Knex } from 'knex';
import { MetaTable, MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (await knex.schema.hasTable(MetaTableOldV2.OUTLINE_VIEW)) {
    await knex.schema.renameTable(
      MetaTableOldV2.OUTLINE_VIEW,
      MetaTable.LIST_VIEW,
    );
  }

  if (await knex.schema.hasTable(MetaTableOldV2.OUTLINE_VIEW_COLUMNS)) {
    await knex.schema.renameTable(
      MetaTableOldV2.OUTLINE_VIEW_COLUMNS,
      MetaTable.LIST_VIEW_COLUMNS,
    );
  }

  if (await knex.schema.hasTable(MetaTableOldV2.OUTLINE_VIEW_LEVELS)) {
    await knex.schema.renameTable(
      MetaTableOldV2.OUTLINE_VIEW_LEVELS,
      MetaTable.LIST_VIEW_LEVELS,
    );
  }
};

const down = async (knex: Knex) => {
  if (await knex.schema.hasTable(MetaTable.LIST_VIEW)) {
    await knex.schema.renameTable(
      MetaTable.LIST_VIEW,
      MetaTableOldV2.OUTLINE_VIEW,
    );
  }

  if (await knex.schema.hasTable(MetaTable.LIST_VIEW_COLUMNS)) {
    await knex.schema.renameTable(
      MetaTable.LIST_VIEW_COLUMNS,
      MetaTableOldV2.OUTLINE_VIEW_COLUMNS,
    );
  }

  if (await knex.schema.hasTable(MetaTable.LIST_VIEW_LEVELS)) {
    await knex.schema.renameTable(
      MetaTable.LIST_VIEW_LEVELS,
      MetaTableOldV2.OUTLINE_VIEW_LEVELS,
    );
  }
};

export { up, down };
