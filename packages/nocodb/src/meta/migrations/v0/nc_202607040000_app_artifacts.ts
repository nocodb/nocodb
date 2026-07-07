import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.APP_ARTIFACTS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_app_id', 20).notNullable();
    table.string('git_sha', 40).notNullable();
    // 'repo' | 'dist' | 'published' — which storage object this sha owns.
    table.string('kind', 20).notNullable();
    table.timestamps(true, true);
    table.primary(['id']);
    // Idempotent record(): one row per (app, sha, kind).
    table.unique(['fk_app_id', 'git_sha', 'kind'], {
      indexName: 'nc_app_artifacts_uniq',
    });
    // Drives the per-app orphan sweep + delete-cascade lookup.
    table.index(['fk_workspace_id', 'fk_app_id'], 'nc_app_artifacts_app');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.APP_ARTIFACTS);
};

export { up, down };
