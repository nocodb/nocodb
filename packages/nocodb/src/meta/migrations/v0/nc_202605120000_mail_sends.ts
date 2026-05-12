import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.MAIL_SENDS, (table) => {
    table.string('id', 20).primary();
    table.string('event', 64).notNullable();
    table.string('fk_user_id', 20).nullable();
    table.string('to_email', 320).notNullable();
    table.text('subject');
    table.string('status', 16).notNullable();
    table.string('delivery_status', 16).nullable();
    table.string('dedupe_key', 255).nullable();
    table.text('payload_json').nullable();
    table.string('ses_message_id', 128).nullable();
    table.text('error').nullable();
    table.integer('attempts').notNullable().defaultTo(0);
    table.dateTime('scheduled_for').nullable();
    table.timestamps(true, true);
    table.dateTime('sent_at').nullable();

    table.index(['status', 'scheduled_for'], 'nc_mail_sends_dispatch_idx');
    table.index(['fk_user_id', 'created_at'], 'nc_mail_sends_user_idx');
    table.index('ses_message_id', 'nc_mail_sends_message_idx');
  });

  // Partial unique index on (event, dedupe_key) for idempotency on deferred
  // sends. PG-only — MySQL doesn't support partial indexes. App-level dedupe
  // is enforced via ON CONFLICT DO NOTHING (PG) or SELECT-then-INSERT (MySQL).
  const client = (knex.client.config.client as string) ?? '';
  if (client === 'pg') {
    await knex.raw(
      `CREATE UNIQUE INDEX nc_mail_sends_dedupe_uq ON ?? (event, dedupe_key) WHERE dedupe_key IS NOT NULL`,
      [MetaTable.MAIL_SENDS],
    );
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.MAIL_SENDS);
};

export { up, down };
