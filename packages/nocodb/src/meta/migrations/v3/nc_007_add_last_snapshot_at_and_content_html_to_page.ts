import Page from '../../../models/Page';
import { MetaTable } from '../../meta.service';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  const workspaces = await knex(MetaTable.WORKSPACE).select('id');

  for (const workspace of workspaces) {
    await knex.schema.alterTable(
      await Page.tableName({
        workspaceId: workspace.id,
        projectId: workspace.id,
      }),
      (table) => {
        // Add last_snapshot_at column
        table.timestamp('last_snapshot_at').nullable();
        table.string('last_snapshot_id').nullable();
        table.text('content_html', 'longtext').defaultTo('');
      },
    );
  }
};

const down = async (knex: Knex) => {
  const workspaces = await knex(MetaTable.WORKSPACE).select('id');

  for (const workspace of workspaces) {
    await knex.schema.alterTable(
      await Page.tableName({
        workspaceId: workspace.id,
        projectId: workspace.id,
      }),
      (table) => {
        // Add last_snapshot_at column
        table.dropColumn('last_snapshot_at');
        table.string('last_snapshot_id').nullable();
        table.dropColumn('content_html');
      },
    );
  }
};

export { up, down };
