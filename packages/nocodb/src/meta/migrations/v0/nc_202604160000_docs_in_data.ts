import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add document-related columns to nc_models_v2
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.string('parent_id', 20).nullable();
    table.string('updated_by', 20);
    table.boolean('has_children').defaultTo(false);
    table.integer('doc_version');

    // Tree index for efficient doc hierarchy queries
    table.index(['base_id', 'parent_id', 'order'], 'nc_models_v2_tree_idx');
  });

  // Migrate existing documents from nc_docs_v2 into nc_models_v2
  if (await knex.schema.hasTable('nc_docs_v2')) {
    const docs = await knex('nc_docs_v2').select('*');

    const batch = docs.map((doc) => ({
      id: doc.id,
      base_id: doc.base_id,
      fk_workspace_id: doc.fk_workspace_id,
      title: doc.title,
      meta: doc.meta,
      order: doc.order,
      parent_id: doc.parent_id,
      deleted: doc.deleted,
      has_children: doc.has_children,
      doc_version: doc.version,
      created_by: doc.created_by,
      updated_by: doc.updated_by,
      type: 'document',
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    }));

    if (batch.length) {
      await knex.batchInsert(MetaTable.MODELS, batch, 100);
    }
  }
};

const down = async (knex: Knex) => {
  // Remove migrated document rows
  await knex(MetaTable.MODELS).where('type', 'document').delete();

  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.dropIndex(
      ['base_id', 'parent_id', 'order'],
      'nc_models_v2_tree_idx',
    );
    table.dropColumn('parent_id');
    table.dropColumn('updated_by');
    table.dropColumn('has_children');
    table.dropColumn('doc_version');
  });
};

export { up, down };
