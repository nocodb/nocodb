import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import {
  up as createDocContent,
  down as dropDocContent,
} from '~/meta/migrations/docs-content/nc_001_init';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DOCS, (table) => {
    table.string('id', 20).notNullable();
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('title', 512);
    table.text('meta'); // JSON metadata (icon, cover, lock, etc.)
    table.float('order');
    table.string('parent_id', 20).nullable();
    table.boolean('deleted').defaultTo(false);
    table.boolean('has_children').defaultTo(false);
    table.integer('version').defaultTo(1);
    table.string('created_by', 20);
    table.string('updated_by', 20);
    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    table.index(['base_id', 'fk_workspace_id'], 'nc_docs_v2_tenant_idx');
    table.index(['base_id', 'parent_id', 'order'], 'nc_docs_v2_tree_idx');
  });

  // DOC_CONTENT table — reuse the docs-content migration (single source
  // of truth so the same schema runs against NC_DOCS_DB when configured).
  await createDocContent(knex);

  // Add doc comment columns to existing COMMENTS table
  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.string('fk_doc_id', 20).nullable();
    table.string('anchor_id', 20).nullable();
    table.index(['fk_doc_id'], 'nc_comments_doc_idx');
  });

  // Add fk_doc_id to FILE_REFERENCES for tracking doc image/file attachments.
  // Index created in separate migration (nc_202603050001)
  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.string('fk_doc_id', 20).nullable();
  });
};

const down = async (knex: Knex) => {
  // Index dropped in separate migration (nc_202603050001)
  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.dropColumn('fk_doc_id');
  });
  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.dropIndex(['fk_doc_id'], 'nc_comments_doc_idx');
    table.dropColumn('fk_doc_id');
    table.dropColumn('anchor_id');
  });
  await dropDocContent(knex);
  await knex.schema.dropTableIfExists(MetaTable.DOCS);
};

export { up, down };
