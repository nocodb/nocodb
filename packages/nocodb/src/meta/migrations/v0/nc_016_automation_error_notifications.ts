import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.timestamp('error_notified_at', { useTz: true }).nullable();
  });
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.index(
      ['status', 'error_notified_at'],
      'nc_automation_executions_error_notify_idx',
    );
  });

  await knex(MetaTable.AUTOMATION_EXECUTIONS)
    .where('status', 'error')
    .update({ error_notified_at: knex.fn.now() });

  await knex.schema.createTable(
    MetaTable.AUTOMATION_SUBSCRIBERS,
    (table) => {
      table.string('id', 20)
      table.string('fk_workspace_id', 20);
      table.string('base_id', 20)
      table.string('fk_automation_id', 20)
      table.string('fk_user_id', 20)
      table.boolean('notify_on_error').defaultTo(true);
      table.timestamps({ defaultToNow: true, useTimestamps: true})

      table.primary(['base_id', 'id']);
    },
  );

  await knex.schema.alterTable(MetaTable.AUTOMATION_SUBSCRIBERS, (table) => {
    table.index(
      ['fk_automation_id'],
      'nc_automation_subscribers_automation_idx',
    );
    table.index(
      ['fk_user_id'],
      'nc_automation_subscribers_user_idx',
    );
    table.unique(['fk_automation_id', 'fk_user_id'], {
      indexName: 'nc_automation_subscribers_unique_idx',
    });
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.AUTOMATION_SUBSCRIBERS);

  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.dropIndex(
      ['status', 'error_notified_at'],
      'nc_automation_executions_error_notify_idx',
    );
  });
  await knex.schema.alterTable(MetaTable.AUTOMATION_EXECUTIONS, (table) => {
    table.dropColumn('error_notified_at');
  });
};

export { up, down };
