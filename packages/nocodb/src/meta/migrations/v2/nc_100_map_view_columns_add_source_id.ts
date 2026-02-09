import type { Knex } from 'knex';
import { Logger } from '@nestjs/common';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_100_map_view_columns_add_source_id');

const up = async (knex: Knex) => {
  // Safety net: nc_037 missed MAP_VIEW_COLUMNS when renaming columns.
  // nc_099 may have already run as a no-op if project_id was missing.
  // Ensure source_id column exists so map view creation works.

  if (
    !(await knex.schema.hasColumn(MetaTable.MAP_VIEW_COLUMNS, 'source_id'))
  ) {
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
  // Only drop if we added it (check it exists)
  if (await knex.schema.hasColumn(MetaTable.MAP_VIEW_COLUMNS, 'source_id'))
    await knex.schema.alterTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
      table.dropColumn('source_id');
    });
};

export { up, down };
