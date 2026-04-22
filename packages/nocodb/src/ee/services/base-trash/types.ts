import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type BaseTrash from '~/models/BaseTrash';

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

  trash(
    ctx: NcContext,
    id: string,
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
}

export const TRASH_HANDLER_TOKEN = 'TRASH_HANDLERS';
