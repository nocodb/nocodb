import { ModelTypes } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import { migrateTableInBatches } from '~/utils/migrationUtils';

const logger = new Logger('nc_091_unify_models');

const up = async (knex: Knex) => {
  logger.log('Migration Started');

  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    // nc_dashboards_v2
    table.string('created_by', 20);
    table.string('owned_by', 20);
    table.string('uuid', 255);
    table.string('password', 255);
    table.string('fk_custom_url_id', 20);

    // Indexes

    table.index('uuid');
    table.index('type');
  });

  logger.log('Added columns and indexes');

  logger.log('Starting migration of data from nc_models to nc_dashboards_v2');

  // First get all dashboard pairs
  const dashboardPairs = await knex
    .select('fk_workspace_id', 'base_id')
    .from(MetaTable.DASHBOARDS)
    .groupBy('fk_workspace_id', 'base_id');

  // Then get max orders only for those specific pairs
  const maxOrders = await knex
    .from(MetaTable.MODELS)
    .select('fk_workspace_id', 'base_id')
    .max('order as max_order')
    .whereIn(
      ['fk_workspace_id', 'base_id'],
      dashboardPairs.map((p) => [p.fk_workspace_id, p.base_id]),
    )
    .where((builder) => {
      builder.whereNull('source_id').orWhereExists((subquery) => {
        subquery
          .select('*')
          .from(MetaTable.SOURCES)
          .where('nc_sources_v2.id', 'nc_models_v2.source_id')
          .where('nc_sources_v2.is_meta', true)
          .where('nc_sources_v2.is_local', true);
      });
    })
    .groupBy('fk_workspace_id', 'base_id');

  // Create lookup map
  const maxOrderMap = new Map();
  maxOrders.forEach((row) => {
    maxOrderMap.set(
      `${row.fk_workspace_id}:${row.base_id}`,
      row.max_order || -1,
    );
  });

  await migrateTableInBatches(
    knex,
    MetaTable.DASHBOARDS,
    MetaTable.MODELS,
    async (dashboard) => {
      const key = `${dashboard.fk_workspace_id}:${dashboard.base_id}`;
      dashboard.order = (maxOrderMap.get(key) || -1) + 1;

      return {
        id: dashboard.id,
        base_id: dashboard.base_id,
        title: dashboard.title,
        type: ModelTypes.DASHBOARD, // Set type to distinguish from other records
        meta: dashboard.meta,
        deleted: false,
        order: dashboard.order,
        created_at: dashboard.created_at,
        updated_at: dashboard.updated_at,
        description: dashboard.description,
        fk_workspace_id: dashboard.fk_workspace_id,
        created_by: dashboard.created_by,
        owned_by: dashboard.owned_by,
        uuid: dashboard.uuid,
        password: dashboard.password,
        fk_custom_url_id: dashboard.fk_custom_url_id,
      };
    },
    logger,
  );

  logger.log('Data migration completed for nc_dashboards_v2 to nc_models');

  logger.log('Dropping tables');

  // await knex.schema.dropTableIfExists(MetaTable.DASHBOARDS);

  logger.log('Dropping tables completed');

  logger.log('Migration Completed');
};

const down = async (knex: Knex) => {
  logger.log('Rollback Migration Started');

  await knex.schema.createTable(MetaTable.DASHBOARDS, function (table) {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('title', 255).notNullable();
    table.text('description');
    table.text('meta');
    table.integer('order');
    table.string('created_by', 20);
    table.string('owned_by', 20);
    table.string('uuid', 255);
    table.string('password', 255);
    table.string('fk_custom_url_id', 20);

    table.timestamps(true, true);
    table.index(['base_id', 'fk_workspace_id'], 'nc_dashboards_v2_context');
  });

  logger.log('Created nc_dashboards_v2 table');

  logger.log('Starting migration of data from nc_models to nc_dashboards_v2');

  await migrateTableInBatches(
    knex,
    MetaTable.MODELS,
    MetaTable.DASHBOARDS,
    (model) => {
      return {
        id: model.id,
        fk_workspace_id: model.fk_workspace_id,
        base_id: model.base_id,
        title: model.title,
        description: model.description,
        meta: model.meta,
        order: model.order,
        created_by: model.created_by,
        owned_by: model.owned_by,
        uuid: model.uuid,
        password: model.password,
        fk_custom_url_id: model.fk_custom_url_id,

        created_at: model.created_at,
        updated_at: model.updated_at,
      };
    },
    logger,
    {
      whereConditions: (queryBuilder) => {
        return queryBuilder.where('type', ModelTypes.DASHBOARD);
      },
    },
  );

  logger.log('Data migration completed from nc_models to nc_dashboards_v2');

  logger.log('Cleaning up nc_models table');

  await knex(MetaTable.MODELS).whereIn('type', [ModelTypes.DASHBOARD]).del();

  logger.log('Cleaning up nc_models table completed');

  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    // Indexes
    table.dropIndex('uuid');
    table.dropIndex('type');

    // nc_dashboards_v2
    table.dropColumn('created_by');
    table.dropColumn('owned_by');
    table.dropColumn('uuid');
    table.dropColumn('password');
    table.dropColumn('fk_custom_url_id');
  });

  logger.log('Rollback Migration Completed');
};

export { up, down };
