import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DOC_REVISIONS, (table) => {
    table.string('id', 40).notNullable();
    table.string('fk_doc_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.integer('version').notNullable();
    table.text('content');
    table.string('title', 255);
    table.string('created_by', 20);
    // Per-tab UUID (x-nc-tab-id header) — discriminates same-author writes
    // across browser tabs / devices so they don't coalesce into one row.
    table.string('fk_tab_id', 36);
    table.string('source', 16).notNullable().defaultTo('auto');
    table.timestamps(true, true);

    table.primary(['id']);
    table.index(
      ['fk_doc_id', 'created_at'],
      'nc_doc_revisions_v2_doc_created_idx',
    );
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_doc_revisions_v2_tenant_idx',
    );
  });

  const isPg =
    knex.client.config.client === 'pg' ||
    knex.client.config.client === 'postgresql';

  if (isPg) {
    await knex.raw(
      `ALTER TABLE ?? ALTER COLUMN content TYPE jsonb USING content::jsonb`,
      [MetaTable.DOC_REVISIONS],
    );
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.DOC_REVISIONS);
};

export { up, down };
