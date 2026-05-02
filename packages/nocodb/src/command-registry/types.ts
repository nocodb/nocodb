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
export interface OperationContract<S extends ZodTypeAny = ZodTypeAny> {
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

  readonly resolveCtx?: (ctx: NcContext, p: z.infer<S>) => Promise<ResolvedCtx>;
  readonly skipIf?: (
    ctx: NcContext,
    p: z.infer<S>,
    r: any,
    resolved?: ResolvedCtx,
  ) => Promise<boolean> | boolean;
  readonly deps?: (p: z.infer<S>, r: any) => TraceCommandDep[];
  readonly extraCommandMeta?: (
    p: z.infer<S>,
    r: any,
  ) => Record<string, any> | undefined;
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
> = (ctx: NcContext, params: ParamsOf<C>, meta: HandlerMeta) => Promise<unknown>;

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

export interface ResolvedCtx {
  entityTitle?: string;
  parentEntityTitle?: string;
  extra?: Record<string, any>;
}

export interface DescCtx {
  entityTitle?: string;
  parentEntityTitle?: string;
  operation: string;
  extra?: Record<string, any>;
}
export type DescFn = (ctx: DescCtx) => string;
