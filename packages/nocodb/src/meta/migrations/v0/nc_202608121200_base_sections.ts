import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Base-level sections — collapsible folders in the Data sidebar that group the
 * entities living directly under a base: tables, root documents and dashboards.
 *
 * Distinct from `nc_view_sections`, which groups views *inside* one table and is
 * keyed by `fk_model_id`. Base sections are keyed by `base_id` alone.
 *
 * Sections share a single visual `order` sequence with the entities they sit
 * among, so `order` here is comparable against top-level `nc_models_v2.order`
 * — see BaseSection.insert().
 */
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.BASE_SECTIONS, (table) => {
    table.string('id', 20).notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20).notNullable();

    table.string('title', 255).notNullable();
    table.float('order');
    table.text('meta');

    table.string('created_by', 20);
    table.string('updated_by', 20);

    table.timestamps(true, true);

    // Base-scoped composite PK — lets the same id exist in two bases
    // (sandbox <-> production), which sandbox-merge id preservation requires.
    table.primary(['base_id', 'id']);
    table.index('id', 'nc_base_sections_id_idx');
    table.index(['base_id', 'fk_workspace_id'], 'nc_base_sections_context');
  });

  // One FK column covers every sidebar entity kind: tables, documents AND
  // dashboards are all nc_models_v2 rows (discriminated by `type`) — the
  // legacy nc_dashboards_v2 table holds no live rows.
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.string('fk_base_section_id', 20).nullable();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.dropColumn('fk_base_section_id');
  });

  await knex.schema.dropTableIfExists(MetaTable.BASE_SECTIONS);
};

export { up, down };
