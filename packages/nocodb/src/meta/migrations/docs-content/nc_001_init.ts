import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DOC_CONTENT, (table) => {
    table.string('fk_doc_id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.text('content');
    table.timestamps(true, true);

    table.primary(['base_id', 'fk_doc_id']);
    table.index(['base_id', 'fk_workspace_id'], 'nc_doc_content_v2_tenant_idx');
  });

  const isPg =
    knex.client.config.client === 'pg' ||
    knex.client.config.client === 'postgresql';

  if (isPg) {
    await knex.raw(
      `ALTER TABLE ?? ALTER COLUMN content TYPE jsonb USING content::jsonb`,
      [MetaTable.DOC_CONTENT],
    );
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.DOC_CONTENT);
};

export { up, down };
