import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add document-related columns to nc_models_v2
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.string('parent_id', 20).nullable();
    table.string('updated_by', 20);
    table.boolean('has_children').defaultTo(false);
    table.integer('doc_version').defaultTo(1);

    // Tree index for efficient doc hierarchy queries.
    // `type` is included as the 2nd column so queries like
    //   WHERE base_id=? AND type='document' AND parent_id=? ORDER BY order
    // seek directly to doc rows instead of returning every model row in the
    // base (tables/dashboards/etc. all share parent_id IS NULL) and filtering
    // by type post-seek.
    table.index(
      ['base_id', 'type', 'parent_id', 'order'],
      'nc_models_v2_tree_idx',
    );
  });

  // Migrate existing documents from nc_docs_v2 into nc_models_v2
  if (await knex.schema.hasTable('nc_docs_v2')) {
    const docs = await knex('nc_docs_v2').select('*');

    // Offset root-level docs so they appear AFTER existing tables/dashboards
    // within each base. Before this migration, nc_models_v2 rows had no
    // parent_id, so every existing row is effectively root-level.
    const baseIds = [...new Set(docs.map((d) => d.base_id).filter(Boolean))];

    const maxOrderByBase = new Map<string, number>();
    if (baseIds.length) {
      const rows = await knex(MetaTable.MODELS)
        .whereIn('base_id', baseIds)
        .groupBy('base_id')
        .select('base_id')
        .max({ maxOrder: 'order' });

      for (const row of rows) {
        maxOrderByBase.set(row.base_id, Number(row.maxOrder) || 0);
      }
    }

    const batch = docs.map((doc) => {
      const isRoot = !doc.parent_id;
      const offset = isRoot ? maxOrderByBase.get(doc.base_id) || 0 : 0;

      return {
        id: doc.id,
        base_id: doc.base_id,
        fk_workspace_id: doc.fk_workspace_id,
        title: doc.title,
        meta: doc.meta,
        order: (Number(doc.order) || 0) + offset,
        parent_id: doc.parent_id,
        deleted: doc.deleted,
        has_children: doc.has_children,
        doc_version: doc.version,
        created_by: doc.created_by,
        updated_by: doc.updated_by,
        type: 'document',
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      };
    });

    if (batch.length) {
      await knex.batchInsert(MetaTable.MODELS, batch, 100);
    }
  }
};

const down = async (knex: Knex) => {
  // Non-destructive rollback: only drop the schema additions.
  // The original nc_docs_v2 rows are preserved by up() (not deleted),
  // and the migrated rows in nc_models_v2 are left in place so no data
  // is destroyed on rollback.
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.dropIndex(
      ['base_id', 'type', 'parent_id', 'order'],
      'nc_models_v2_tree_idx',
    );
    table.dropColumn('parent_id');
    table.dropColumn('updated_by');
    table.dropColumn('has_children');
    table.dropColumn('doc_version');
  });
};

export { up, down };
