/**
 * Per-tab operation log row backing the undo/redo stack.
 *
 * One row per recorded forward op. The row carries the inverse op name +
 * params needed to revert it. The status machine drives the stack:
 *   active → undone (on undo) → active (on redo) → undone …
 *     └──→ errored (terminal — preserved for inspection, not eligible for
 *                   further undo/redo)
 */
export interface OperationLogType {
  id?: string;
  /**
   * Monotonic per-tab ordering hint. Persisted as a millisecond timestamp at
   * insert time so the latest active entry can be looked up cheaply via an
   * `(fk_user_id, base_id, tab_id, status, seq)` index.
   */
  seq?: number;
  fk_workspace_id?: string;
  base_id?: string;
  fk_user_id?: string;
  /**
   * Per-tab UUID sourced from the `x-nc-tab-id` request header. Generated
   * fresh per page load on the GUI side so undo doesn't survive reloads
   * (matches Baserow's ClientSessionId model).
   */
  tab_id?: string;

  /** Operation that was performed (matches `OperationContract.name`). */
  forward_op?: string;
  forward_op_version?: number;
  /** JSON-encoded params replayed by the forward op on redo. */
  forward_params?: string;

  /** Operation that reverts the forward (matches `OperationContract.name`). */
  inverse_op?: string;
  inverse_op_version?: number;
  /** JSON-encoded params replayed by the inverse op on undo. */
  inverse_params?: string;

  /** Display / audit fields. Captured at record time so they survive renames. */
  entity_type?: string;
  entity_id?: string;
  entity_title?: string;
  description?: string;

  /**
   * Undo-stack partition. Cmd-Z while viewing a specific table/view/dashboard
   * only pops rows whose `(scope_type, scope_id)` matches. Resolved at
   * forward record time by the contract; inverse ops (macroUndo, trashRestore)
   * inherit the row's scope.
   */
  scope_type?: OperationLogScopeType;
  scope_id?: string;

  status?: OperationLogStatus;
  /** Populated when status is 'errored'. */
  error?: string;
  undone_at?: string | null;
  meta?: Record<string, any>;
  cleanup_due_at?: string | null;

  created_at?: string;
  updated_at?: string;
}

export type OperationLogStatus =
  | 'active'
  | 'undone'
  | 'errored'
  | 'discarded';

export type OperationLogScopeType =
  | 'base'
  | 'table'
  | 'view'
  | 'dashboard'
  | 'workflow'
  | 'script';
