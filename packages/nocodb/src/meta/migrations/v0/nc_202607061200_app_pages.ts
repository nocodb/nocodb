import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.APP_PAGES, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_app_id', 20).notNullable();
    table.string('type', 20).notNullable().defaultTo('agent');
    table.string('route', 191).notNullable();
    table.string('title', 255).notNullable();
    table.string('slug', 80).notNullable();
    table.integer('order').defaultTo(0);
    table.text('meta');
    table.boolean('deleted').defaultTo(false);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.unique(['base_id', 'fk_app_id', 'route'], { indexName: 'nc_app_pages_app_route' });
    table.unique(['base_id', 'fk_app_id', 'slug'], { indexName: 'nc_app_pages_app_slug' });
    table.index(['base_id', 'fk_workspace_id'], 'nc_app_pages_ctx');
  });
  // Frozen per-version page snapshot (JSON). Serve/invoke read this immutable
  // per-version copy, not the mutable nc_app_pages draft rows.
  await knex.schema.alterTable(MetaTable.APP_VERSIONS, (table) => {
    table.text('pages_snapshot');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.APP_VERSIONS, (table) => {
    table.dropColumn('pages_snapshot');
  });
  await knex.schema.dropTable(MetaTable.APP_PAGES);
};

export { up, down };
