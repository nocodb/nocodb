import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.INTERFACES, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

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

    table.index(['base_id', 'fk_workspace_id'], 'nc_interfaces_context');
  });

  await knex.schema.createTable(MetaTable.INTERFACE_PAGES, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
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

    table.float('order');

    table.string('created_by', 20);

    table.boolean('deleted').defaultTo(false);

    table.timestamps(true, true);

    table.index(['base_id', 'fk_workspace_id'], 'nc_interface_pages_context');
    table.index('fk_interface_id', 'nc_interface_pages_interface_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.INTERFACE_PAGES);
  await knex.schema.dropTable(MetaTable.INTERFACES);
};

export { up, down };
