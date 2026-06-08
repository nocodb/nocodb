import type { z, ZodTypeAny } from 'zod';
import type { MetaTable } from '~/utils/globals';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ColumnBackupRef } from '~/services/column-data-backup-handler';
import type { LtarSideEffectIds } from '~/services/columns.service.type';
import type { OperationName } from './op-names';

/**
 * Versioned, typed declaration of one state-mutating operation. Three
 * orthogonal concerns:
 *
 *  - `entry` (always relevant) — what gets recorded on the changelog row.
 *  - `undo`  (opt-in)          — only set if the op is undoable.
 *  - `sandbox` (opt-in)        — only set if the op flows through sandbox replay.
 *
 * `name@version` is the registry lookup key and the `event` column in
 * `nc_sandbox_changelog`. Bump `version` when the schema or replay semantics
 * change in a way old changelog rows can't replay against the new contract;
 * v1 and v2 coexist until v1 rows drain.
 */
export interface OperationContract<
  S extends ZodTypeAny = ZodTypeAny,
  E = Record<string, any>,
  R = any,
> {
  readonly name: OperationName;
  readonly version?: number;
  readonly entity: MetaTable;
  readonly schema: S;

  readonly entry?: OperationEntry<S, E, R>;
  /** Object = record undo; `false` = explicit opt-out. */
  readonly undo?: OperationUndo<S, E, R> | false;
  /** Object = record sandbox changelog; `false` = explicit opt-out. */
  readonly sandbox?: OperationSandbox<S, R> | false;

  /**
   * Trace-ALS keys to persist as `meta.extra` on the operation-log /
   * sandbox-changelog row. Used by both destinations — independent of
   * `sandbox: false`. Values are deposited via `captureForTrace(key, value)`
   * during the forward run.
   */
  readonly capture?: ReadonlyArray<CaptureKey>;
  /** Validates the `meta.extra` payload before persistence. Strict. */
  readonly capture_schema?: ZodTypeAny;

  readonly on_record_failure?: FailureCleanupFn;

  /**
   * Marks the op as a "macro" — a user-facing action that fans out to
   * multiple traced child operations.
   */
  readonly macro?: boolean;
}

export interface OperationEntry<
  S extends ZodTypeAny = ZodTypeAny,
  E = Record<string, any>,
  R = any,
> {
  readonly entity_id?: string | EntityRefFn<S, R>;
  readonly entity_title?: string | EntityRefFn<S, R>;
  readonly parent_id?: string | EntityRefFn<S, R>;
  readonly description?: string | DescFn;
  /** Pre-call hook: snapshot pre-state for undo / description / skip_if. */
  readonly before?: (
    context: NcContext,
    params: z.infer<S>,
  ) => Promise<ResolvedCtx<E>>;
  /** Suppress recording when the call was a no-op (e.g. delete-of-missing-row). */
  readonly skip_if?: (
    context: NcContext,
    params: z.infer<S>,
    result: R,
    resolved?: ResolvedCtx<E>,
  ) => Promise<boolean> | boolean;
}

export interface OperationUndo<
  S extends ZodTypeAny = ZodTypeAny,
  E = Record<string, any>,
  R = any,
> {
  /** Returns the inverse op for undo; `null` skips recording. */
  readonly inverse: (
    context: NcContext,
    params: z.infer<S>,
    result: R,
    resolved?: ResolvedCtx<E>,
  ) => Promise<InverseOp | null> | InverseOp | null;
  /**
   * Resolves the per-tab undo/redo stack this op belongs to. Persisted on
   * `nc_operation_logs.scope_type` / `scope_id`. `UndoRedoService` filters
   * by `(user, tab, scope_type, scope_id)` so Cmd-Z while viewing table A
   * only pops ops scoped to table A. Resolved at forward record time —
   * inverse ops consume the existing row's scope.
   *
   * Lives inside `undo` because scope only affects the operation-log path;
   * sandbox merge is partition-agnostic. Required iff the op is undoable
   * (i.e. `undo` is set to an object rather than `false`).
   *
   * See `src/command-registry/scope.ts` for builders and the dynamic-scope
   * helper used by rename-class `*Update` ops.
   */
  readonly scope: ScopeResolver<S, E, R>;
}

export interface OperationSandbox<S extends ZodTypeAny = ZodTypeAny, R = any> {
  /**
   * Property name in `params` whose value is the create-body object. The
   * dispatcher injects `entry.entity_id` into `params[id_field].id` at
   * replay so production rows preserve sandbox IDs (`metaInsert2` honors
   * pre-set `id`).
   */
  readonly id_field?: string;
  /**
   * Related entity IDs the forward op references but doesn't own (e.g. a
   * formula column → other columns). Persisted on `meta.deps`, used by
   * sandbox cherry-pick to auto-include referenced entities.
   */
  readonly dependencies?: (params: z.infer<S>, result: R) => TraceCommandDep[];
}

export interface InverseOp {
  name: OperationName;
  version?: number;
  params: unknown;
}

/** Resolves `contract.undo` to its config object, treating `false` as opt-out. */
export function getUndoConfig<C extends OperationContract<any, any, any>>(
  contract: C,
): OperationUndo | undefined {
  return contract.undo === false ? undefined : contract.undo;
}

/** Resolves `contract.sandbox` to its config object, treating `false` as opt-out. */
export function getSandboxConfig<C extends OperationContract<any, any, any>>(
  contract: C,
): OperationSandbox | undefined {
  return contract.sandbox === false ? undefined : contract.sandbox;
}

export type EntityRefFn<
  S extends ZodTypeAny,
  R = any,
  E = Record<string, any>,
> = (
  params: z.infer<S>,
  result: R,
  resolved?: ResolvedCtx<E>,
) => string | undefined;

// Match all 3 generics so contracts that supply non-default E/R still match
// (E and R appear in both covariant and contravariant positions in callbacks,
// making them invariant — single-arg `infer S` falls through to `never`).
export type ParamsOf<C> = C extends OperationContract<
  infer S,
  infer _E,
  infer _R
>
  ? z.infer<S>
  : never;

export type CommandHandler<
  C extends OperationContract<any> = OperationContract<any>,
> = (
  context: NcContext,
  params: ParamsOf<C>,
  meta: HandlerMeta,
) => Promise<unknown>;

/**
 * Optional rollback hook for side-effects the forward op created BEFORE
 * `recordCommand` ran. Invoked by the decorator when the changelog row
 * couldn't be persisted (recordCommand threw OR returned `persisted=false`
 * because there was no sandbox AND no tab to record into). Receives the
 * trace-scope's capture snapshot so the contract can read its own
 * `captureForTrace` deposits and drop whatever it owns.
 *
 * Attached to the contract via `on_record_failure`. Failures inside the
 * cleanup itself are logged and swallowed.
 */
export type FailureCleanupFn = (
  context: NcContext,
  capture: Partial<CaptureBag>,
) => Promise<void>;

export interface HandlerMeta {
  entryId: string;
  entityId?: string;
  originalReq: NcRequest;
  createdBy: string;
  extra?: Partial<CaptureBag>;
}

export interface ChangelogCommandPayload {
  name: string;
  version: number;
  params: unknown;
  extra?: Record<string, unknown>;
}

export interface TraceCommandDep {
  entity: MetaTable;
  id: string;
}

/**
 * One recorded child operation inside a macro op's transcript. The
 * macro op's @TraceCommand decorator (in `macro: true` mode) auto-
 * appends one of these for every nested @TraceCommand call. On replay
 * the macro's registered handler iterates the transcript and re-invokes
 * each child via the OperationRegistry — same dispatch loop as
 * `SandboxCommandReplayService`.
 */
export interface MacroTranscriptEntry {
  /** Child op's contract name (an OperationName value). */
  op: string;
  /** Child contract version — guards against schema drift. */
  version: number;
  /** Forward params for the child, post-NON_SERIALIZABLE_KEYS filtering.
   *  Validated lazily against the resolved contract.schema on replay. */
  params: unknown;
  /** Captured side-effect ids (LTAR fan-out, filter ids, backup ref,
   *  etc.) — the same shape the child contract opts into via
   *  `sandbox.capture`. Restored to setReplay slots on replay so the
   *  child's existing replay logic reuses the original ids. */
  extra?: Partial<CaptureBag>;
  /** Snapshot from the child's `entry.before` return value. This is
   *  the contract's E-generic (e.g. ColumnUpdate snapshots `prev` here
   *  for its inverse builder). Persisted opaque on this side; typed
   *  back at the inverse-builder call site. Required for any child
   *  whose `undo.inverse` reads `resolved.extra.*`. */
  resolvedExtra?: unknown;
  /** Primary entity id created/affected by this child. Used by the
   *  child handler's trash-restore short-circuit on replay (e.g.
   *  ColumnAddContract checks `meta.entityId` against the trash). */
  entityId?: string;
}

/**
 * Typed shape of every value depositable into the trace-ALS capture bag.
 * Add a key here, then deposit via `captureForTrace(key, value)` and opt
 * into persistence on the contract via `sandbox.capture: [key]`.
 */
export interface CaptureBag {
  /** LTAR side-effect IDs (junction model, FK cols, back-link, reverse LTAR). */
  ltar: LtarSideEffectIds;
  /** Filter tree bundled at column/hook create time. */
  filters: ReadonlyArray<Record<string, unknown>>;
  /** Cell-data backup ref captured at destructive column type-changes. */
  backup: ColumnBackupRef;
  /** Set on a SingleLineText→link conversion: the created link column id +
   *  the replaced text column snapshot — needed to invert the conversion. */
  convertedLink: { linkColumnId: string; textColumn: Record<string, unknown> };
  /** Set on a link→SingleLineText conversion: the created text column id, so
   *  redo (and sandbox replay) recreates the text column with the same id. */
  convertedText: { textColumnId: string };
  /** Every column created during a table-create (system + user + LTAR junction). */
  sandboxColumns: ReadonlyArray<{
    id?: string;
    cn?: string;
    title?: string;
  }>;
  /** Default-view id captured at table-create. */
  sandboxDefaultViewId: string;
  /** View ids that lived in a section at delete time — needed to re-link
   *  child views when the section is recreated on undo. */
  viewSectionViewIds: ReadonlyArray<string>;
  /** Filter ids created as side-effects of `rowColorConditionAdd` (the
   *  inner filter tree).
   */
  rowColorFilterIds: ReadonlyArray<string>;
  /** Recorded child operations of a macro op — populated by the
   *  decorator's auto-instrument branch when the parent contract has
   *  `macro: true`. The macro's registered handler iterates this on
   *  replay (undo/redo or sandbox merge) instead of re-running the
   *  service body. */
  macroTranscript: ReadonlyArray<MacroTranscriptEntry>;
  /** Pre-mutation row snapshots for record-CRUD inverses. Populated
   *  by `BaseModelSqlv2.updateByPk/bulkUpdate/delByPk/bulkDelete` at
   *  the existing audit-read site (no dual read). Inverse builders for
   *  `recordUpdate` / `recordDelete` / their bulk variants read these
   *  to construct the reverse op. Order matches the input row order. */
  recordPrev: ReadonlyArray<Record<string, unknown>>;
  /** Side-effect rows mutated by an insert/update with nested LTAR
   *  data. Captured BEFORE each mutating op inside
   *  `prepareNestedLinkQb` so undo can restore the prior state.
   *
   *  Two variants:
   *   - `column`: a row's FK column was overwritten (V1 OO BT-side
   *     null-out; V1 OO HM-side reassign; V1 HM child re-parenting).
   *   - `junction`: a junction row was deleted to enforce single-link
   *     cardinality (V2 OO, V2 OM, V2 MO with OO sub-case).
   */
  displacedRecords: ReadonlyArray<DisplacedRecord>;
  /** Persisted alongside record-CRUD ops (insert / delete / update) so
   *  replay (redo) doesn't depend on re-resolving the model from
   *  baseName/tableName at undo time — those lookups fail for renamed
   *  bases / tables and aren't always present in v3-style param shapes.
   *  Written by `entry.before` on the forward path and read by the
   *  replay handler. */
  recordModelContext: {
    modelId: string;
    /** All pk titles in canonical order; consumers join values with
     *  `___` for composite-pk display. */
    primaryKeyTitles: string[];
  };
  /** ID of the BaseTrash row inserted by `afterSoftDeleteCompleted`.
   *  Captured at the point of insertion (no extra lookup) so undo /
   *  redo can call `baseTrashSvc.restore(trashId)` directly. Bulk
   *  soft-deletes write ONE entry covering all rows in the batch, so a
   *  single id captures the whole bulk delete. */
  softDeleteTrashId: string;
  /** V3-update LTAR diff: per-(col, row, target) link mutations produced
   *  by `updateLTARCols`. Captured by `bulkUpdate` before dispatching to
   *  the LTAR updater (CE, Mux, or EE LinksRequestHandler — the diff is
   *  computed once at the entry point so all three downstream paths are
   *  covered uniformly). Undo iterates and inverts: 'add' → removeLinks,
   *  'remove' → addLinks. */
  linkChanges: ReadonlyArray<LinkChange>;
  /** Pre-move neighbor for `recordMove`. `beforeRowId` = pk of the row
   *  that was immediately after the moved row in the pre-move ordering
   *  (or `null` if it was at the end). The inverse `moveRecord` call
   *  uses this as its own `beforeRowId` to put the row back in place. */
  movePrev: { pk: string | number; beforeRowId: string | number | null };
  /** Per-row outcome of `bulkUpsert`. Updates carry `prev` so undo can
   *  restore. Inserts ride redo on a trashId rotated into
   *  `softDeleteTrashId` by the inverse handler — pk preservation
   *  matters because re-running upsert would assign new auto-pks. */
  upsertChanges: ReadonlyArray<
    | {
        kind: 'update';
        pk: string | number;
        prev: Record<string, unknown>;
      }
    | { kind: 'insert'; pk: string | number }
  >;
}

/** One add-or-remove operation against a single LTAR column on a single
 *  row. `childIds` carries the targets being added or removed in this
 *  diff slice (the LTAR diff computed against the row's existing links).
 */
export interface LinkChange {
  op: 'add' | 'remove';
  /** The LTAR column id (NOT the FK column id). */
  colId: string;
  baseId: string;
  /** Owner row pk (composite-pk join via `___` for multi-key tables). */
  rowId: string;
  /** Linked-side row pks added or removed. */
  childIds: ReadonlyArray<string | number>;
}

export type DisplacedRecord =
  | {
      kind: 'column';
      /** Model whose row was mutated (resolved via `Model.get` at restore). */
      modelId: string;
      baseId: string;
      /** Composite-pk value (joined with `___` for multi-key tables). */
      pk: string;
      /** DB-level column_name (not title) — restored via raw UPDATE. */
      column: string;
      /** Value before the mutation (used by undo to restore prev state). */
      prev: unknown;
      /** What the forward op set this column to (used by redo to re-apply
       *  the displaced state). `'null'` = OO BT-side null-out;
       *  `'newRowPk'` = HM/OO-HM-side reassignment to inserted row's pk.
       *  Soft-delete-snapshot entries (no actual mutation) omit this
       *  so the redo path skips them. */
      forward?: 'null' | 'newRowPk';
      /** When `forward: 'newRowPk'`, the pk of the inserted row whose pk
       *  was set on this displaced row's FK. Stamped by `postInsertOps`
       *  in `prepareNestedLinkQb` after the insert assigns the pk. */
      forwardPk?: string;
    }
  | {
      kind: 'junction';
      /** Junction (mm) model id. */
      mmModelId: string;
      baseId: string;
      colId: string;
      parentMMCol: string;
      childMMCol: string;
      parentValue: string | number;
      childValue: string | number;
    };

export type CaptureKey = keyof CaptureBag;

export interface ResolvedCtx<E = Record<string, any>> {
  entityTitle?: string;
  parentEntityTitle?: string;
  extra?: E;
}

export interface DescCtx {
  entityTitle?: string;
  parentEntityTitle?: string;
  operation: string;
  extra?: Record<string, any>;
}
export type DescFn = (context: DescCtx) => string;

/**
 * The five undo-stack partitions, plus `workflow`/`script` for content
 * edits inside their respective editors (added so rename-class updates can
 * land on the base stack while content edits stay inside the editor).
 *
 * Scope is set at forward record time on `nc_operation_logs`. Inverse ops
 * (macroUndo, trashRestore) inherit the row's scope — no re-resolution.
 */
export type ScopeType =
  | 'base'
  | 'table'
  | 'view'
  | 'dashboard'
  | 'workflow'
  | 'script';

export interface ScopeRef {
  type: ScopeType;
  id: string;
}

/**
 * Computes the scope for a forward op. Called by `recordCommand` after
 * `entry.before` and the service body have run, so `resolved.extra` and
 * `result` are both populated.
 */
export type ScopeResolver<
  S extends ZodTypeAny = ZodTypeAny,
  E = Record<string, any>,
  R = any,
> = (
  params: z.infer<S>,
  result: R,
  resolved: ResolvedCtx<E> | undefined,
  context: NcContext,
) => ScopeRef;
