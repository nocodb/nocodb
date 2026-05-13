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

    // Undo stack partition. Cmd-Z on a table page only pops rows with
    // (scope_type='table', scope_id=that_table_id) — `(user, tab)` alone
    // would conflate ops across every table/view/dashboard the user has
    // touched in the tab.
    //
    // scope_type ∈ {'base','table','view','dashboard','workflow','script'}.
    // Resolved at forward record time by `contract.scope(...)`; inverse
    // ops (macroUndo, trashRestore) inherit the existing row's scope.
    table.string('scope_type', 32);
    table.string('scope_id', 36);

    // 'active'  → freshly recorded forward (or redone), undoable.
    // 'undone'  → undo was applied; redoable via popping latest undone.
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
    // Primary lookup: latest active/undone entry for a
    // (user, tab, scope). `seq DESC` is the order we pop from.
    table.index(
      ['fk_user_id', 'tab_id', 'scope_type', 'scope_id', 'status', 'seq'],
      'nc_op_logs_user_tab_scope_status_seq_idx',
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
