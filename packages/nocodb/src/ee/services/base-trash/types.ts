import type { UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type BaseTrash from '~/models/BaseTrash';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import { cleanBaseSchemaCacheForBase } from '~/helpers/scriptHelper';

export interface TrashCallParam {
  user: Partial<UserType>;
  req: NcRequest;
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
    ncMeta?: MetaService,
  ): Promise<void>;

  permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void>;

  /**
   * Optional pre-restore plan-limit check. Each handler decides whether the
   * resource type has a per-base / per-workspace cap and throws
   * NcError.planLimitExceeded when restoration would cross it. No-op if the
   * resource type has no quota.
   */
  checkRestoreLimit?(ctx: NcContext, trashEntry: BaseTrash): Promise<void>;

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
    ncMeta?: MetaService,
  ): Promise<void>;

  abstract permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void>;

  checkRestoreLimit?(ctx: NcContext, trashEntry: BaseTrash): Promise<void>;

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
}

export const TRASH_HANDLER_TOKEN = 'TRASH_HANDLERS';
