import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_016_rename_base_id_to_source_id');

const up = async (knex: Knex) => {
  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.LAYOUT}' table`,
  );
  await knex.schema.alterTable(MetaTable.LAYOUT, (table) => {
    table.renameColumn('base_id', 'source_id');
  });
  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.LAYOUT}' table`,
  );
  await knex.schema.alterTable(MetaTable.LAYOUT, (table) => {
    table.renameColumn('project_id', 'base_id');
  });
};

const down = async (_knex: Knex) => {};

export { up, down };
