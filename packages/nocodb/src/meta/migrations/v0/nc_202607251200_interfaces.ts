import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.INTERFACES, (table) => {
    table.string('id', 20).notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20).notNullable();

    table.string('title', 255).notNullable();
    table.text('description');
    table.text('meta');
    table.float('order');

    table.boolean('hidden');

    table.timestamp('first_published_at');
    table.timestamp('last_published_at');

    table.string('created_by', 20);
    table.string('owned_by', 20);

    table.boolean('deleted').defaultTo(false);

    table.timestamps(true, true);

    // Base-scoped composite PK — lets the same id exist in two bases
    // (sandbox ↔ production), which sandbox-merge id preservation requires.
    table.primary(['base_id', 'id']);
    table.index('id', 'nc_interfaces_id_idx');
    table.index(['base_id', 'fk_workspace_id'], 'nc_interfaces_context');
  });

  await knex.schema.createTable(MetaTable.INTERFACE_PAGES, (table) => {
    table.string('id', 20).notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20).notNullable();
    table.string('fk_interface_id', 20).notNullable();

    // Source table — null for OVERVIEW layout
    table.string('fk_model_id', 20);

    table.string('title', 255).notNullable();
    table.string('layout', 30).notNullable();

    // Page appearance meta (icon etc.)
    table.text('meta');

    // false = unparented (record-detail pages, modal record forms)
    table.boolean('show_in_nav').defaultTo(true);
    table.string('visual_variant', 20);

    // Draft config (live-edited) and published snapshot
    table.text('config');
    table.text('published_config');
    table.boolean('is_published').defaultTo(false);
    table.boolean('keep_as_draft').defaultTo(false);
    table.timestamp('draft_modified_at');
    table.timestamp('published_at');

    // Dependency-validation flag (broken column/page references)
    table.boolean('error').defaultTo(false);

    // Public share-to-web (page-level, read-only)
    table.string('uuid', 255);
    table.string('password', 255);
    // Share links resolve by uuid alone (`InterfacePage.getByUUID`) on an
    // unauthenticated route — index it like `nc_views_v2` does.
    table.index('uuid', 'nc_interface_pages_uuid_idx');

    table.float('order');

    table.string('created_by', 20);

    table.boolean('deleted').defaultTo(false);

    table.timestamps(true, true);

    // Base-scoped composite PK (see nc_interfaces above).
    table.primary(['base_id', 'id']);
    table.index('id', 'nc_interface_pages_id_idx');
    table.index(['base_id', 'fk_workspace_id'], 'nc_interface_pages_context');
    table.index('fk_interface_id', 'nc_interface_pages_interface_idx');
  });

  // Team-grant descendant expansion for interface grants — same semantics as
  // permission/RLS subjects ('self_only' | 'self_and_descendants', absent =
  // self_and_descendants). Only meaningful on TEAM-principal rows.
  await knex.schema.alterTable(MetaTable.PRINCIPAL_ASSIGNMENTS, (table) => {
    table.string('hierarchy_scope', 30);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PRINCIPAL_ASSIGNMENTS, (table) => {
    table.dropColumn('hierarchy_scope');
  });
  await knex.schema.dropTable(MetaTable.INTERFACE_PAGES);
  await knex.schema.dropTable(MetaTable.INTERFACES);
};

export { up, down };
