import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable, MetaTableOldV2 } from '~/utils/globals';

const logger = new Logger('nc_036_rename_project_and_base');

const up = async (knex: Knex) => {
  logger.log('Renaming base table');
  if (await knex.schema.hasTable(MetaTableOldV2.BASES))
    await knex.schema.renameTable(MetaTableOldV2.BASES, MetaTable.SOURCES);

  logger.log('Renaming `base_id` column to `source_id`');
  if (await knex.schema.hasColumn(MetaTable.MODELS, 'base_id'))
    await knex.schema.alterTable(MetaTable.MODELS, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.COLUMNS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.COLUMNS, 'base_id'))
    await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.VIEWS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.VIEWS, 'base_id'))
    await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.GALLERY_VIEW}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.GALLERY_VIEW, 'base_id'))
    await knex.schema.alterTable(MetaTable.GALLERY_VIEW, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.GRID_VIEW}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.GRID_VIEW, 'base_id'))
    await knex.schema.alterTable(MetaTable.GRID_VIEW, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.KANBAN_VIEW}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.KANBAN_VIEW, 'base_id'))
    await knex.schema.alterTable(MetaTable.KANBAN_VIEW, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.FORM_VIEW}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.FORM_VIEW, 'base_id'))
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.MAP_VIEW}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.MAP_VIEW, 'base_id'))
    await knex.schema.alterTable(MetaTable.MAP_VIEW, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.GALLERY_VIEW_COLUMNS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.GALLERY_VIEW_COLUMNS, 'base_id'))
    await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.GRID_VIEW_COLUMNS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.GRID_VIEW_COLUMNS, 'base_id'))
    await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.KANBAN_VIEW_COLUMNS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.KANBAN_VIEW_COLUMNS, 'base_id'))
    await knex.schema.alterTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.FORM_VIEW_COLUMNS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.FORM_VIEW_COLUMNS, 'base_id'))
    await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.SORT}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.SORT, 'base_id'))
    await knex.schema.alterTable(MetaTable.SORT, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.FILTER_EXP}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.FILTER_EXP, 'base_id'))
    await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.HOOKS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.HOOKS, 'base_id'))
    await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.HOOK_LOGS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.HOOK_LOGS, 'base_id'))
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.MODEL_ROLE_VISIBILITY}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.MODEL_ROLE_VISIBILITY, 'base_id'))
    await knex.schema.alterTable(MetaTable.MODEL_ROLE_VISIBILITY, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.AUDIT}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.AUDIT, 'base_id'))
    await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'base_id' column to 'source_id' in '${MetaTable.SYNC_LOGS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.SYNC_SOURCE, 'base_id'))
    await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
      table.renameColumn('base_id', 'source_id');
    });

  logger.log(
    `Renaming 'fk_sync_base_id' column to 'fk_sync_source_id' in '${MetaTable.SYNC_LOGS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.SYNC_LOGS, 'fk_sync_base_id'))
    await knex.schema.alterTable(MetaTable.SYNC_LOGS, (table) => {
      table.renameColumn('fk_sync_base_id', 'fk_sync_source_id');
    });

  logger.log('Renaming project table');
  if (await knex.schema.hasTable(MetaTableOldV2.PROJECT))
    await knex.schema.renameTable(MetaTableOldV2.PROJECT, MetaTable.PROJECT);

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.MODELS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.MODELS, 'project_id'))
    await knex.schema.alterTable(MetaTable.MODELS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.COLUMNS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.COLUMNS, 'project_id'))
    await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.VIEWS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.VIEWS, 'project_id'))
    await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.GALLERY_VIEW}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.GALLERY_VIEW, 'project_id'))
    await knex.schema.alterTable(MetaTable.GALLERY_VIEW, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.GRID_VIEW}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.GRID_VIEW, 'project_id'))
    await knex.schema.alterTable(MetaTable.GRID_VIEW, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.KANBAN_VIEW}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.KANBAN_VIEW, 'project_id'))
    await knex.schema.alterTable(MetaTable.KANBAN_VIEW, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.FORM_VIEW}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.FORM_VIEW, 'project_id'))
    await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.MAP_VIEW}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.MAP_VIEW, 'project_id'))
    await knex.schema.alterTable(MetaTable.MAP_VIEW, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.GALLERY_VIEW_COLUMNS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.GALLERY_VIEW_COLUMNS, 'project_id'))
    await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.GRID_VIEW_COLUMNS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.GRID_VIEW_COLUMNS, 'project_id'))
    await knex.schema.alterTable(MetaTable.GRID_VIEW_COLUMNS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.KANBAN_VIEW_COLUMNS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.KANBAN_VIEW_COLUMNS, 'project_id'))
    await knex.schema.alterTable(MetaTable.KANBAN_VIEW_COLUMNS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.FORM_VIEW_COLUMNS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.FORM_VIEW_COLUMNS, 'project_id'))
    await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.SORT}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.SORT, 'project_id'))
    await knex.schema.alterTable(MetaTable.SORT, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.FILTER_EXP}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.FILTER_EXP, 'project_id'))
    await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.HOOKS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.HOOKS, 'project_id'))
    await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.HOOK_LOGS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.HOOK_LOGS, 'project_id'))
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.MODEL_ROLE_VISIBILITY}' table`,
  );
  if (
    await knex.schema.hasColumn(MetaTable.MODEL_ROLE_VISIBILITY, 'project_id')
  )
    await knex.schema.alterTable(MetaTable.MODEL_ROLE_VISIBILITY, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.AUDIT}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.AUDIT, 'project_id'))
    await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.SYNC_LOGS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.SYNC_LOGS, 'project_id'))
    await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.SYNC_LOGS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.SYNC_LOGS, 'project_id'))
    await knex.schema.alterTable(MetaTable.SYNC_LOGS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(`Renaming Project Users table`);
  if (await knex.schema.hasTable(MetaTableOldV2.PROJECT_USERS))
    await knex.schema.renameTable(
      MetaTableOldV2.PROJECT_USERS,
      MetaTable.PROJECT_USERS,
    );

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.PROJECT_USERS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.PROJECT_USERS, 'project_id'))
    await knex.schema.alterTable(MetaTable.PROJECT_USERS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.SOURCES}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.SOURCES, 'project_id'))
    await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.STORE}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.STORE, 'project_id'))
    await knex.schema.alterTable(MetaTable.STORE, (table) => {
      table.renameColumn('project_id', 'base_id');
    });

  logger.log(
    `Renaming 'project_id' column to 'base_id' in '${MetaTable.API_TOKENS}' table`,
  );
  if (await knex.schema.hasColumn(MetaTable.API_TOKENS, 'project_id'))
    await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
      table.renameColumn('project_id', 'base_id');
    });
};

const down = async (_knex: Knex) => {};

export { up, down };
