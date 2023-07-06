import { MetaTable } from '../../../utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.BOOK, (table) => {
    table.dropForeign('project_id');
    table.dropForeign('created_by_id');
    table.dropForeign('last_updated_by_id');
    table.dropForeign('last_published_by_id');
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.index('fk_workspace_id');
  });

  await knex.schema.alterTable(MetaTable.FOLLOWER, (table) => {
    table.dropForeign('fk_user_id');
    table.dropForeign('fk_follower_id');
    table.index('fk_user_id');
    table.index('fk_follower_id');

    table.dropIndex(['fk_user_id', 'fk_follower_id']);
  });

  await knex.schema.alterTable(MetaTable.COWRITER, (table) => {
    table.dropForeign('fk_model_id');
    table.index('fk_model_id');
    table.dropForeign('created_by');
    table.index('created_by');
  });

  await knex.schema.alterTable(
    MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
    async (table) => {
      table.dropForeign(
        'dashboard_project_id',
        'nc_ds_dashboard_to_db_project__dashboard_id',
      );
      table.index('dashboard_project_id');
      table.dropForeign(
        'db_project_id',
        'nc_ds_dashboard_to_db_project__db_id',
      );
      table.index('db_project_id');
    },
  );

  await knex.schema.alterTable(
    MetaTable.WIDGET_DB_DEPENDENCIES,
    async (table) => {
      table.dropForeign('widget_id');
      table.index('widget_id');
      table.dropForeign('model_id');
      table.index('model_id');
      table.dropForeign('view_id');
      table.index('view_id');
      table.dropForeign('column_id');
      table.index('column_id');
    },
  );

  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropForeign('fk_widget_id');
    table.index('fk_widget_id');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.BOOK, (table) => {
    table.dropIndex('project_id');
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);
    table.dropIndex('created_by_id');
    table.foreign('created_by_id').references(`${MetaTable.USERS}.id`);
    table.dropIndex('last_updated_by_id');
    table.foreign('last_updated_by_id').references(`${MetaTable.USERS}.id`);
    table.dropIndex('last_published_by_id');
    table.foreign('last_published_by_id').references(`${MetaTable.USERS}.id`);
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropIndex('fk_workspace_id');
  });

  await knex.schema.alterTable(MetaTable.FOLLOWER, (table) => {
    table.dropIndex('fk_user_id');
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);
    table.dropIndex('fk_follower_id');
    table.foreign('fk_follower_id').references(`${MetaTable.USERS}.id`);
    table.index(['fk_user_id', 'fk_follower_id']);
  });

  await knex.schema.alterTable(MetaTable.COWRITER, (table) => {
    table.dropIndex('fk_model_id');
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);
    table.dropIndex('created_by');
    table.foreign('created_by').references(`${MetaTable.USERS}.id`);
  });

  await knex.schema.alterTable(
    MetaTable.DASHBOARD_PROJECT_DB_PROJECT_LINKINGS,
    async (table) => {
      table.dropIndex('dashboard_project_id');
      table
        .foreign('dashboard_project_id')
        .references(`${MetaTable.PROJECT}.id`)
        .withKeyName('nc_ds_dashboard_to_db_project__dashboard_id');
      table.dropIndex('db_project_id');
      table
        .foreign('db_project_id')
        .references(`${MetaTable.PROJECT}.id`)
        .withKeyName('nc_ds_dashboard_to_db_project__db_id');
    },
  );

  await knex.schema.alterTable(
    MetaTable.WIDGET_DB_DEPENDENCIES,
    async (table) => {
      table.dropIndex('widget_id');
      table.foreign('widget_id').references(`${MetaTable.WIDGET}.id`);
      table.dropIndex('model_id');
      table.foreign('model_id').references(`${MetaTable.MODELS}.id`);
      table.dropIndex('view_id');
      table.foreign('view_id').references(`${MetaTable.VIEWS}.id`);
      table.dropIndex('column_id');
      table.foreign('column_id').references(`${MetaTable.COLUMNS}.id`);
    },
  );

  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropIndex('fk_widget_id');
    table.foreign('fk_widget_id').references(`${MetaTable.WIDGET}.id`);
  });
};

export { up, down };
