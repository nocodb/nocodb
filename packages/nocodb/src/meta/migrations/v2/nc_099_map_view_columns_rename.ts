import type { Knex } from 'knex';
import { Logger } from '@nestjs/common';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_099_map_view_columns_rename');

const up = async (knex: Knex) => {
  // nc_037 missed renaming columns in MAP_VIEW_COLUMNS table.
  // Subsequent migrations (nc_050, nc_092, nc_097) built indexes and
  // composite PK on the old 'base_id' column, so we can't safely rename it.
  // Instead, just add the missing 'source_id' column that the code expects.

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
  if (await knex.schema.hasColumn(MetaTable.MAP_VIEW_COLUMNS, 'source_id'))
    await knex.schema.alterTable(MetaTable.MAP_VIEW_COLUMNS, (table) => {
      table.dropColumn('source_id');
    });
};

export { up, down };
