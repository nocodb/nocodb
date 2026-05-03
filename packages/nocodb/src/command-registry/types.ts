import type { z, ZodTypeAny } from 'zod';
import type { MetaTable } from '~/utils/globals';
import type { NcContext, NcRequest } from '~/interface/config';
import type { OperationName } from './op-names';

/**
 * Versioned, typed declaration of a single state-mutating operation. Each
 * contract is the single source of truth for:
 *
 *  - Identity         — `name` + `version` (registry lookup key, also used
 *                        as the `event` column in `nc_sandbox_changelog`).
 *  - Param shape      — `schema` validates and shapes the persisted params at
 *                        record time (strict — throws on mismatch). `extraSchema`
 *                        validates handler-side metadata threaded via `extra`.
 *  - Entity reference — `entityId` / `entityTitle` / `parentId` / `parentTitle`
 *                        extract identifying fields from `param` or the service
 *                        result for changelog rows. Fall back to `idField`
 *                        (a key in `param` whose value is the created entity).
 *  - Replay context   — `resolveCtx` runs before the original method to capture
 *                        pre-state (e.g. old title for rename detection).
 *                        `skipIf` runs after, suppressing record when the call
 *                        was a no-op.
 *  - Cross-refs       — `deps` returns related entity IDs so replay can stitch
 *                        foreign-key references across the merge boundary.
 *                        `extraCommandMeta` packs additional payload (e.g.
 *                        sandbox column IDs) onto the changelog row.
 *  - Description      — human-readable summary for audit UIs (string or DescFn
 *                        receiving entity/parent titles).
 *
 * Add new contracts under `src/ee/command-registry/operations/` and register
 * a handler in the matching `handlers/` file — see `CLAUDE.md` for the full
 * end-to-end checklist.
 */
export interface OperationContract<
  S extends ZodTypeAny = ZodTypeAny,
  /**
   * Shape of `ResolvedCtx['extra']` for this contract. Lets `resolveCtx` /
   * `buildInverse` / `skipIf` see typed pre-state instead of casting through
   * `as any`. Defaults to `Record<string, any>` so existing contracts that
   * stash `{ fieldTitle, tableTitle }` keep compiling.
   */
  E = Record<string, any>,
> {
  readonly name: OperationName;
  readonly version: number;
  readonly entity: MetaTable;

  readonly schema: S;
  readonly extraSchema?: ZodTypeAny;

  readonly idField?: string;

  readonly entityId?: string | EntityRefFn<S>;
  readonly entityTitle?: string | EntityRefFn<S>;
  readonly parentId?: string | EntityRefFn<S>;
  readonly parentTitle?: string | EntityRefFn<S>;
  readonly description?: string | DescFn;

  readonly resolveCtx?: (
    ctx: NcContext,
    p: z.infer<S>,
  ) => Promise<ResolvedCtx<E>>;
  readonly skipIf?: (
    ctx: NcContext,
    p: z.infer<S>,
    r: any,
    resolved?: ResolvedCtx<E>,
  ) => Promise<boolean> | boolean;
  readonly deps?: (p: z.infer<S>, r: any) => TraceCommandDep[];
  readonly extraCommandMeta?: (
    p: z.infer<S>,
    r: any,
  ) => Record<string, any> | undefined;

  /**
   * If defined, the operation is undoable. `recordCommand` writes a row to
   * `nc_operation_logs` after the forward op succeeds, capturing the inverse
   * op name + params returned here. Undo dispatches the inverse via
   * `OperationRegistry.resolve(name, version)`.
   *
   * Return `null` to skip recording (e.g. operation was a no-op).
   *
   * Runs after the forward op completes — has access to the result so it can
   * read auto-assigned IDs or pre-state captured via `resolveCtx`.
   */
  readonly buildInverse?: (
    ctx: NcContext,
    p: z.infer<S>,
    r: any,
    resolved?: ResolvedCtx<E>,
  ) => Promise<InverseOp | null> | InverseOp | null;
}

/**
 * The inverse of a forward op — what undo dispatches via the OperationRegistry.
 * `name` must match a registered contract's `name`. `params` is `unknown` at
 * the type level (the forward and inverse contracts are decoupled); the
 * dispatcher narrows via the resolved contract's schema at runtime.
 */
export interface InverseOp {
  name: OperationName;
  version?: number;
  params: unknown;
}

export type EntityRefFn<S extends ZodTypeAny> = (
  p: z.infer<S>,
  r: any,
) => string | undefined;

export type ParamsOf<C> = C extends OperationContract<infer S>
  ? z.infer<S>
  : never;

export type CommandHandler<
  C extends OperationContract<any> = OperationContract<any>,
> = (
  ctx: NcContext,
  params: ParamsOf<C>,
  meta: HandlerMeta,
) => Promise<unknown>;

export interface HandlerMeta {
  entryId: string;
  entityId?: string;
  originalReq: NcRequest;
  createdBy: string;
  extra?: Record<string, unknown>;
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
export type DescFn = (ctx: DescCtx) => string;
