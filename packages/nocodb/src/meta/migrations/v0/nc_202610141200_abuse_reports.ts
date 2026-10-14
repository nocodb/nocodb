import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * Abuse reports filed by anonymous visitors of public shares.
 *
 * Titles and workspace name are snapshots and ids carry no FK, so a report
 * outlives the resource or workspace it is about.
 */
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.ABUSE_REPORTS, (table) => {
    table.string('id', 20).primary();

    table.string('resource_type', 50).notNullable();
    table.string('resource_id', 20).notNullable();
    table.string('resource_title', 255);
    table.string('fk_workspace_id', 20);
    table.string('workspace_title', 255);
    table.string('base_id', 20);
    table.text('public_url').notNullable();

    table.string('reason', 50).notNullable();
    table.text('description').notNullable();
    table.string('reporter_name', 150).notNullable();
    table.string('reporter_email', 255).notNullable();
    table.string('ip', 64);
    table.string('user_agent', 512);

    table.boolean('admins_notified').defaultTo(false);
    table.string('status', 20).defaultTo('open');

    table.timestamps(true, true);

    // Notification cooldown lookup.
    table.index(
      ['resource_type', 'resource_id', 'created_at'],
      'nc_abuse_reports_resource_idx',
    );
    // Rate limit lookup (per IP and resource).
    table.index(['ip', 'resource_id', 'created_at'], 'nc_abuse_reports_ip_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.ABUSE_REPORTS);
};

export { up, down };
