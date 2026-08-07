import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Grants — the "blocks" the balance is made of. remaining_micro burns down
  // only inside settle/clawback/expire transactions.
  await knex.schema.createTable(MetaTable.CREDIT_GRANTS, (table) => {
    table.string('id', 20).primary();
    table.string('scope', 20); // workspace | org | installation
    table.string('fk_scope_id', 20);
    table.string('type', 20); // plan | topup | promo | adjustment
    table.bigInteger('amount_micro'); // immutable grant size (micro-credits)
    table.bigInteger('remaining_micro'); // burn-down state
    table.integer('priority').defaultTo(20); // plan 10, promo 15, topup 20
    table.timestamp('effective_at');
    table.timestamp('expires_at');
    table.string('source_type', 40); // plan | stripe_checkout
    table.string('source_id', 255);
    table.text('meta');
    table.timestamps(true, true);
    table.unique(['source_type', 'source_id']); // idempotent issuance
    table.index(['scope', 'fk_scope_id']);
    table.index(['expires_at']); // reaper scans WHERE expires_at <= now every 5m
  });

  // Ledger — append-only history of every balance movement. Never mutated;
  // enforced by CreditService, not the schema.
  await knex.schema.createTable(MetaTable.CREDIT_LEDGER, (table) => {
    table.string('id', 20).primary();
    table.string('scope', 20);
    table.string('fk_scope_id', 20);
    table.string('fk_grant_id', 20); // null = unattributed overshoot remainder
    table.string('fk_workspace_id', 20); // which workspace spent it, when known
    table.string('fk_subscription_id', 20); // Stripe reconciliation only
    table.string('entry_type', 20); // grant | consume | expire | clawback | adjust
    table.bigInteger('amount_micro'); // signed; negative = debit
    table.string('service', 20); // ai | compute | null
    table.text('usage'); // JSON CreditUsageRef — this row's segment
    table.string('rate_version', 20);
    table.string('idempotency_key', 255);
    // Every row one settle wrote; equals the caller's requestRef, linking the
    // charge back to the action that caused it.
    table.string('correlation_id', 255);
    table.string('fk_base_id', 20);
    table.string('fk_user_id', 20);
    table.timestamps(true, true);
    table.unique(['idempotency_key']);
    // `id` tail: one settle writes many rows in the same instant.
    table.index(['scope', 'fk_scope_id', 'created_at', 'id']); // ledger page
    table.index(['scope', 'fk_scope_id', 'fk_grant_id']); // sumUnattributed
    table.index(['scope', 'fk_scope_id', 'correlation_id']); // group one action
  });

  // Holds — transient reservations for streaming calls; deleted on settle,
  // reaped when expired.
  await knex.schema.createTable(MetaTable.CREDIT_HOLDS, (table) => {
    table.string('id', 20).primary();
    table.string('scope', 20);
    table.string('fk_scope_id', 20);
    table.bigInteger('amount_micro');
    table.string('service', 20);
    table.string('request_ref', 255).unique();
    table.timestamp('expires_at');
    table.timestamps(true, true);
    table.index(['scope', 'fk_scope_id']);
    table.index(['expires_at']);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.CREDIT_HOLDS);
  await knex.schema.dropTableIfExists(MetaTable.CREDIT_LEDGER);
  await knex.schema.dropTableIfExists(MetaTable.CREDIT_GRANTS);
};

export { up, down };
