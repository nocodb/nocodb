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

  const contextCombinations = await knex(MetaTable.DASHBOARDS)
    .distinct('base_id', 'fk_workspace_id')
    .select();

  const maxOrdersByContext = await knex(MetaTable.MODELS)
    .select('base_id', 'fk_workspace_id')
    .max('order as maxOrder')
    .whereIn(
      ['base_id', 'fk_workspace_id'],
      contextCombinations.map((c) => [c.base_id, c.fk_workspace_id]),
    )
    .groupBy('base_id', 'fk_workspace_id');

  const orderMap = new Map();
  maxOrdersByContext.forEach((row) => {
    const key = `${row.base_id}_${row.fk_workspace_id}`;
    orderMap.set(key, row.maxOrder || 0);
  });

  await migrateTableInBatches(
    knex,
    MetaTable.DASHBOARDS,
    MetaTable.MODELS,
    (dashboard) => {
      const key = `${dashboard.base_id}_${dashboard.fk_workspace_id}`;
      const currentMax = orderMap.get(key) || 0;
      const nextOrder = currentMax + 1;
      orderMap.set(key, nextOrder);
      return {
        id: dashboard.id,
        base_id: dashboard.base_id,
        title: dashboard.title,
        type: ModelTypes.DASHBOARD, // Set type to distinguish from other records
        meta: dashboard.meta,
        deleted: false,
        order: nextOrder,
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
    {
      whereConditions: (queryBuilder) => {
        // Order by indexed fields first, then by order
        return queryBuilder.orderBy(['base_id', 'fk_workspace_id', 'order']);
      },
    },
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
