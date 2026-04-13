import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';

export interface TrashResult<T = any> {
  entity: T;
  relatedItems?: Record<string, any>;
  meta?: Record<string, any>;
  parentType?: string;
  parentId?: string;
  parentName?: string;
}

export interface TrashHandler<T = any> {
  resourceType: string;

  /** Child resource types whose trash entries should be cleaned on permanent delete */
  childTypes?: string[];

  trash(ctx: NcContext, id: string): Promise<TrashResult<T>>;

  restore(ctx: NcContext, trashEntry: BaseTrash): Promise<void>;

  permanentDelete(ctx: NcContext, trashEntry: BaseTrash): Promise<void>;
}

export const TRASH_HANDLER_TOKEN = 'TRASH_HANDLERS';
