import type { UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type BaseTrash from '~/models/BaseTrash';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import { cleanBaseSchemaCacheForBase } from '~/helpers/scriptHelper';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

export interface TrashCallParam<TOptions = unknown> {
  user: Partial<UserType>;
  req: NcRequest;
  /**
   * Caller-supplied parent for the trash entry being created. Lets an
   * orchestrating flow (e.g. a table-sync / app-sync drop) record the trashed
   * resource as a child of another trash entry without the generic handler
   * having to know about the parent. The generic table handler also reads this
   * to permit trashing junction (`mm`) tables when they belong to a `tableSync`
   * or `appSync`. Cross-cutting orchestration metadata — NOT resource-specific.
   */
  parent?: { type: string; id: string; name?: string };
  /**
   * Entity-specific delete options, forwarded verbatim to the handler. Generic
   * (`TOptions`) so each resource type defines and extends its OWN options shape
   * — no resource-specific fields live on this shared param. Each handler
   * narrows its method param to its own options type:
   *   - record    → `TrashCallParam<RecordTrashOptions>`     (`{ force?, partial? }`)
   *   - tableSync → `TrashCallParam<TableSyncTrashOptions>`  (`{ droppedTables? }`)
   *   - appSync   → `TrashCallParam<AppSyncTrashOptions>`    (`{ dropTables?, skipTrash? }`)
   */
  options?: TOptions;
}

/**
 * Cache buckets that a resource type may affect. Each handler declares its
 * own via `affectedCaches`; the base class's `invalidateCaches()` fires them.
 */
export type TrashAffectedCache = 'commandPalette' | 'baseSchema';

export interface TrashResult<T = any> {
  entity: T;
  relatedItems?: Record<string, any>;
  meta?: Record<string, any>;
  parentType?: string;
  parentId?: string;
  parentName?: string;
  /** When true, the resource was hard-deleted (e.g. external source) — skip trash entry creation */
  skipTrashEntry?: boolean;
}

/**
 * Result handlers may return from `restore()` / `permanentDelete()` to control
 * whether the BaseTrash row is auto-deleted by the service after the call. The
 * record handler uses `keepEntry: true` when only a subset of records under
 * the entry were affected (e.g. RLS-bounded user pass) and others remain.
 * Other handlers return `void` for the default delete-after-success behavior.
 */
export interface TrashLifecycleResult {
  keepEntry?: boolean;
}

/**
 * Per-handler enrichment for trash list entries. Returned from `enrich`;
 * consumed by `BaseTrashService.trashList`. Tagged union — exactly one of:
 *
 *   - `{ drop: true }` — hide this entry from the list (e.g. RLS hid every
 *     underlying row). The trash row itself stays in `nc_trash` and may
 *     resurface for users with broader RLS.
 *   - `{ extra: {...} }` — merge those fields onto the entry in the response
 *     (e.g. inline records for `record` entries).
 *
 * Handlers with no enrichment to perform should just not implement the hook.
 */
export type TrashListEnrichment =
  | { drop: true }
  | { extra: Record<string, any> };

export interface TrashHandler<T = any> {
  resourceType: string;

  /** Child resource types whose trash entries should be cleaned on permanent delete */
  childTypes?: string[];

  /**
   * Caches to invalidate after each successful trash / restore / permanent-delete
   * of this resource type. Consumed by `invalidateCaches`.
   */
  affectedCaches?: readonly TrashAffectedCache[];

  trash(
    ctx: NcContext,
    id: string,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashResult<T>>;

  restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashLifecycleResult | void>;

  permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashLifecycleResult | void>;

  /**
   * Lifecycle hook fired by `BaseTrashService.permanentDelete` before any
   * state mutation. Returns:
   *   - `true`  → proceed with child cleanup + `permanentDelete`
   *   - `false` → the underlying entity is already gone (e.g. hard-deleted
   *     out-of-band); skip child cleanup + `permanentDelete`, but still
   *     drop the trash row so it doesn't accumulate retries.
   *
   * May throw `parentInTrash` when the entry's parent has its own trash
   * row — the caller (cron) defers, the controller surfaces it to the
   * user. Default impl on `BaseTrashHandler` does the parent check.
   */
  beforePermanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<boolean>;

  /**
   * Optional pre-restore plan-limit check. Each handler decides whether the
   * resource type has a per-base / per-workspace cap and throws
   * NcError.planLimitExceeded when restoration would cross it. No-op if the
   * resource type has no quota.
   */
  checkRestoreLimit?(ctx: NcContext, trashEntry: BaseTrash): Promise<void>;

  /**
   * Optional per-entry enrichment for `BaseTrashService.trashList`. Use this
   * to attach resource-type-specific data to the entry (e.g. inline record
   * rows for `record` entries) or to filter the entry out of the response
   * (e.g. RLS hid every underlying row).
   *
   * Return `null` to pass the entry through unchanged.
   */
  enrich?(ctx: NcContext, trashEntry: BaseTrash): Promise<TrashListEnrichment>;

  /**
   * Fire the cache invalidations declared in `affectedCaches`. Called by the
   * service after each successful lifecycle operation. Fire-and-forget:
   * failures are swallowed so cache cleanup cannot bubble up to the user.
   */
  invalidateCaches(workspaceId: string, baseId?: string): void;
}

/**
 * Shared base class that implements `invalidateCaches` from `affectedCaches`.
 * Concrete handlers extend this and only need to declare their own
 * `resourceType`, `affectedCaches`, and lifecycle methods.
 */
export abstract class BaseTrashHandler<T = any> implements TrashHandler<T> {
  abstract resourceType: string;
  childTypes?: string[];
  affectedCaches?: readonly TrashAffectedCache[];

  abstract trash(
    ctx: NcContext,
    id: string,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashResult<T>>;

  abstract restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashLifecycleResult | void>;

  abstract permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashLifecycleResult | void>;

  checkRestoreLimit?(ctx: NcContext, trashEntry: BaseTrash): Promise<void>;

  enrich?(ctx: NcContext, trashEntry: BaseTrash): Promise<TrashListEnrichment>;

  invalidateCaches(workspaceId: string, baseId?: string): void {
    const caches = this.affectedCaches;
    if (!caches?.length) return;

    for (const cache of caches) {
      switch (cache) {
        case 'commandPalette':
          cleanCommandPaletteCache(workspaceId).catch(() => {});
          break;
        case 'baseSchema':
          if (baseId) cleanBaseSchemaCacheForBase(baseId).catch(() => {});
          break;
      }
    }
  }

  /**
   * Lifecycle hook fired by `BaseTrashService.permanentDelete` before any
   * state mutation. Returns:
   *   - `true`  → proceed with child cleanup + `permanentDelete`
   *   - `false` → underlying entity already gone (hard-deleted out-of-band);
   *     skip child cleanup + `permanentDelete`, but still drop the trash
   *     row so it doesn't accumulate retries.
   *
   * Default impl throws `parentInTrash` when the entry's parent has its own
   * trash row — the retention cron catches and defers, the controller path
   * surfaces it to the user, `emptyTrash` retries on later passes once the
   * parent's cleanup cascades through this child.
   *
   * Subclasses override to add entity-existence checks that return `false`
   * (see FieldTrashHandler, TableTrashHandler).
   */
  async beforePermanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<boolean> {
    if (!trashEntry.parent_id || !trashEntry.parent_type) return true;
    const parentTrash = await ncMeta
      .knex(MetaTable.TRASH)
      .where({
        fk_workspace_id: ctx.workspace_id,
        base_id: ctx.base_id,
        resource_type: trashEntry.parent_type,
        resource_id: trashEntry.parent_id,
      })
      .first('id');
    if (parentTrash) {
      NcError.get(ctx).parentInTrash(trashEntry.parent_type);
    }
    return true;
  }
}

export const TRASH_HANDLER_TOKEN = 'TRASH_HANDLERS';
