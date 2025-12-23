import { Logger } from '@nestjs/common';
import { AutomationTypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { MetaTable, MetaTableOldV2 } from '~/utils/globals';
import { migrateTableInBatches } from '~/utils/migrationUtils';
const logger = new Logger('nc_011_merge_workflows_scripts');

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.AUTOMATIONS, (table) => {
    table.string('id', 20).primary();

    table.string('title', 255);

    table.text('description');

    table.text('meta');

    table.string('fk_workspace_id', 20);

    table.string('base_id', 20);

    table.float('order');

    // Type discriminator: 'script' or 'workflow'
    table.string('type', 20);

    table.string('created_by', 20);

    table.string('updated_by', 20);

    table.timestamps(true, true);

    // Workflow Fields
    table.boolean('enabled').defaultTo(false);

    table.text('nodes');

    table.text('edges');

    table.text('draft');

    // Script field (nullable for workflows)
    table.text('config');

    table.text('script');

    // Indexes
    table.index(['base_id', 'fk_workspace_id'], 'nc_automations_context_idx');

    table.index(['type'], 'nc_automations_type_idx');

    table.index(['enabled'], 'nc_automations_enabled_idx');

    table.index(['base_id', 'order'], 'nc_automations_order_idx');
  });

  await migrateTableInBatches(
    knex,
    MetaTableOldV2.SCRIPTS,
    MetaTable.AUTOMATIONS,
    (script) => {
      return {
        id: script.id,
        title: script.title,
        description: script.description,
        meta: script.meta,
        fk_workspace_id: script.fk_workspace_id,
        base_id: script.base_id,
        order: script.order,
        type: AutomationTypes.SCRIPT,
        created_by: script.created_by,
        created_at: script.created_at,
        updated_at: script.updated_at,
        script: script.script,
        config: script.config,
      };
    },
    logger,
    {
      whereConditions: (queryBuilder) => {
        return queryBuilder.orderBy(['base_id', 'fk_workspace_id', 'order']);
      },
    },
  );

  const contextCombinations = await knex(MetaTableOldV2.WORKFLOWS)
    .distinct('base_id', 'fk_workspace_id')
    .select();

  // Get max order for each context in automations table (which already has scripts)
  const maxOrdersByContext = await knex(MetaTable.AUTOMATIONS)
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
    MetaTableOldV2.WORKFLOWS,
    MetaTable.AUTOMATIONS,
    (workflow) => {
      const key = `${workflow.base_id}_${workflow.fk_workspace_id}`;
      const currentMax = orderMap.get(key) || 0;
      const nextOrder = currentMax + 1;
      orderMap.set(key, nextOrder);

      return {
        id: workflow.id,
        title: workflow.title,
        description: workflow.description,
        meta: workflow.meta,
        fk_workspace_id: workflow.fk_workspace_id,
        base_id: workflow.base_id,
        order: nextOrder, // Use calculated order to avoid conflicts
        type: AutomationTypes.WORKFLOW,
        created_by: workflow.created_by,
        updated_by: workflow.updated_by,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
        enabled: workflow.enabled,
        nodes: workflow.nodes,
        edges: workflow.edges,
        draft: workflow.draft,
      };
    },
    logger,
    {
      whereConditions: (queryBuilder) => {
        return queryBuilder.orderBy(['base_id', 'fk_workspace_id', 'order']);
      },
    },
  );

  await knex.schema.renameTable(
    MetaTableOldV2.WORKFLOW_EXECUTIONS,
    MetaTable.AUTOMATION_EXECUTIONS,
  );
};

const down = async (knex: Knex) => {
  await migrateTableInBatches(
    knex,
    MetaTable.AUTOMATIONS,
    MetaTableOldV2.SCRIPTS,
    (automation) => {
      return {
        id: automation.id,
        title: automation.title,
        description: automation.description,
        meta: automation.meta,
        fk_workspace_id: automation.fk_workspace_id,
        base_id: automation.base_id,
        order: automation.order,
        created_by: automation.created_by,
        created_at: automation.created_at,
        updated_at: automation.updated_at,
        script: automation.script,
        config: automation.config,
      };
    },
    logger,
    {
      whereConditions: (queryBuilder) => {
        return queryBuilder
          .where('type', AutomationTypes.SCRIPT)
          .orderBy(['base_id', 'fk_workspace_id', 'order']);
      },
    },
  );

  await migrateTableInBatches(
    knex,
    MetaTable.AUTOMATIONS,
    MetaTableOldV2.WORKFLOWS,
    (automation) => {
      return {
        id: automation.id,
        title: automation.title,
        description: automation.description,
        meta: automation.meta,
        fk_workspace_id: automation.fk_workspace_id,
        base_id: automation.base_id,
        order: automation.order,
        created_by: automation.created_by,
        updated_by: automation.updated_by,
        created_at: automation.created_at,
        updated_at: automation.updated_at,
        enabled: automation.enabled,
        nodes: automation.nodes,
        edges: automation.edges,
        draft: automation.draft,
      };
    },
    logger,
    {
      whereConditions: (queryBuilder) => {
        return queryBuilder
          .where('type', AutomationTypes.WORKFLOW)
          .orderBy(['base_id', 'fk_workspace_id', 'order']);
      },
    },
  );

  await knex.schema.dropTable(MetaTable.AUTOMATIONS);
  await knex.schema.renameTable(
    MetaTable.AUTOMATION_EXECUTIONS,
    MetaTableOldV2.WORKFLOW_EXECUTIONS,
  );
};

export { up, down };
