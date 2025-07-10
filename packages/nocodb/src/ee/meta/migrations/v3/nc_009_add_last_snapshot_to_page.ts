import type { Knex } from 'knex';
// import { MetaTable } from '~/utils/globals';
// import Page from '~/models/Page';

const up = async (_knex: Knex) => {
  /* const workspaces = await knex(MetaTable.WORKSPACE).select('id');

  for (const workspace of workspaces) {
    await knex.schema.alterTable(
      await Page.tableName({
        workspaceId: workspace.id,
        baseId: workspace.id,
      }),
      (table) => {
        // Add last_snapshot_at column
        table.dropColumn('last_snapshot_id');
        table.text('last_snapshot_json', 'longtext').nullable();
      },
    );
  } */
};

const down = async (_knex: Knex) => {
  /* const workspaces = await knex(MetaTable.WORKSPACE).select('id');

  for (const workspace of workspaces) {
    await knex.schema.alterTable(
      await Page.tableName({
        workspaceId: workspace.id,
        baseId: workspace.id,
      }),
      (table) => {
        // Add last_snapshot_at column
        table.string('last_snapshot_id').nullable();
        table.dropColumn('last_snapshot_json');
      },
    );
  } */
};
