import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.OPERATION_LOGS, (table) => {
    table.string('id', 20).primary();
    table.bigInteger('seq').notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_user_id', 20);
    // Per-tab UUID sourced from the `x-nc-tab-id` request header. Generated
    // fresh per page load on the GUI side, so undo doesn't survive reloads.
    table.string('tab_id', 100);

    // Forward op (the operation that was performed).
    table.string('forward_op', 80);
    table.smallint('forward_op_version');
    table.text('forward_params');

    // Inverse op (the operation that reverts the forward).
    // Computed at record time via contract.buildInverse(...).
    table.string('inverse_op', 80);
    table.smallint('inverse_op_version');
    table.text('inverse_params');

    // Display / audit fields.
    table.string('entity_type', 40);
    table.string('entity_id', 20);
    table.string('entity_title', 255);
    table.text('description');

    // 'active'  → freshly recorded forward, undoable.
    // 'undone'  → undo was applied; redoable via popping latest undone.
    // 'redone'  → re-applied via redo; identical semantics to 'active' for
    //             the next undo, kept distinct so we can audit the round-trip.
    // 'errored' → undo or redo failed; entry is preserved for inspection but
    //             not eligible for further undo/redo.
    table.string('status', 20).defaultTo('active');
    table.text('error');
    table.timestamp('undone_at');
    table.text('meta');
    table.timestamp('cleanup_due_at');

    table.timestamps(true, true);
  });

  await knex.schema.alterTable(MetaTable.OPERATION_LOGS, (table) => {
    // Primary lookup: latest active/undone entry for a (user, base, tab).
    table.index(
      ['fk_user_id', 'base_id', 'tab_id', 'status', 'seq'],
      'nc_op_logs_user_base_tab_status_seq_idx',
    );
    // Cleanup queries (per-workspace pruning, TTL sweeps).
    table.index(['fk_workspace_id', 'base_id'], 'nc_op_logs_ws_base_idx');
    table.index(['cleanup_due_at'], 'nc_op_logs_cleanup_due_at_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.OPERATION_LOGS);
};

export { up, down };
