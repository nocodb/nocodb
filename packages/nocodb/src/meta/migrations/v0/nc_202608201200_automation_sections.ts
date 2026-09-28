import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Automation sections — collapsible folders in the Workflows sidebar that group
 * a base's automations (workflows and scripts, both `nc_automations` rows).
 *
 * The automations-tab counterpart of `nc_base_sections`. Keyed by `base_id`
 * alone — automations have no source dimension. Sections share a single visual
 * `order` sequence with the automations they sit among, so `order` here is
 * comparable against `nc_automations.order` — see AutomationSection.insert().
 */
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.AUTOMATION_SECTIONS, (table) => {
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
    table.index('id', 'nc_automation_sections_id_idx');
    table.index(['base_id', 'fk_workspace_id'], 'nc_automation_sections_context');
  });

  // One FK column covers both kinds: workflows and scripts are nc_automations
  // rows discriminated by `type`.
  await knex.schema.alterTable(MetaTable.AUTOMATIONS, (table) => {
    table.string('fk_automation_section_id', 20).nullable();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATIONS, (table) => {
    table.dropColumn('fk_automation_section_id');
  });

  await knex.schema.dropTableIfExists(MetaTable.AUTOMATION_SECTIONS);
};

export { up, down };
