import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_202602270448_map_view_columns_add_source_id');

const up = async (knex: Knex) => {
  // nc_037 (v2) missed renaming columns in MAP_VIEW_COLUMNS table.
  // Ensure source_id column exists so map view creation works.

  if (!(await knex.schema.hasColumn(MetaTable.MAP_VIEW_COLUMNS, 'source_id'))) {
    logger.log(
      `Adding missing 'source_id' column to '${MetaTable.MAP_VIEW_COLUMNS}' table`,
    );
    await knex.schema.alterTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
      table.string('source_id', 20);
    });
  } else {
    logger.log(
      `'source_id' column already exists in '${MetaTable.MAP_VIEW_COLUMNS}' table, skipping`,
    );
  }
};

const down = async (knex: Knex) => {
  if (await knex.schema.hasColumn(MetaTable.MAP_VIEW_COLUMNS, 'source_id'))
    await knex.schema.alterTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
      table.dropColumn('source_id');
    });
};

export { up, down };
