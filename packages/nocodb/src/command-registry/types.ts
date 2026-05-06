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
  readonly undo?: OperationUndo<S, E, R>;
  readonly sandbox?: OperationSandbox<S, R>;
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
}

export interface OperationSandbox<S extends ZodTypeAny = ZodTypeAny, R = any> {
  /**
   * Property name in `params` whose value is the create-body object. The
   * dispatcher injects `entry.entity_id` into `params[id_field].id` at
   * replay so production rows preserve sandbox IDs (`metaInsert2` honors
   * pre-set `id`).
   */
  readonly id_field?: string;
  /** Trace-ALS keys to persist as `meta.extra` (deposited via `captureForTrace`). */
  readonly capture?: ReadonlyArray<CaptureKey>;
  /** Validates the `meta.extra` payload before persistence. Strict. */
  readonly capture_schema?: ZodTypeAny;
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

export type EntityRefFn<S extends ZodTypeAny, R = any> = (
  params: z.infer<S>,
  result: R,
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
}

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
