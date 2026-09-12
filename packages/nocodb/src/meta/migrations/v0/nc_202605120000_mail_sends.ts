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
  // sends. PG-only — MySQL doesn't support partial indexes. The deferred
  // dispatch path (`enqueueDeferred`) is itself cloud-only and cloud runs on
  // PG; CE/on-prem only writes audit rows synchronously and never relies on
  // this index, so the absence on MySQL is intentional rather than a gap.
  const client = (knex.client.config.client as string) ?? '';
  if (client === 'pg') {
    await knex.raw(
      `CREATE UNIQUE INDEX nc_mail_sends_dedupe_uq ON ?? (event, dedupe_key) WHERE dedupe_key IS NOT NULL`,
      [MetaTable.MAIL_SENDS],
    );
  }

  // Activation tracking. Nullable so invited-but-never-signed-in users stay
  // NULL — activation-nudge scans filter them out. Populated by the cloud
  // `LastActiveInterceptor` (30-min debounce, in-memory). Indexed because the
  // nudge scanner filters on the column at every run.
  await knex.schema.alterTable(MetaTable.USERS, (t) => {
    t.dateTime('last_active_at').nullable();
  });
  await knex.schema.alterTable(MetaTable.USERS, (t) => {
    t.index(['last_active_at'], 'nc_users_v2_last_active_at_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (t) => {
    t.dropIndex(['last_active_at'], 'nc_users_v2_last_active_at_idx');
  });
  await knex.schema.alterTable(MetaTable.USERS, (t) => {
    t.dropColumn('last_active_at');
  });
  await knex.schema.dropTableIfExists(MetaTable.MAIL_SENDS);
};

export { up, down };
