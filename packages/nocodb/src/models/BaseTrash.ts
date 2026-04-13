import type { BaseTrashType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class BaseTrash implements BaseTrashType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  resource_type?: BaseTrashType['resource_type'];
  resource_id?: string;
  parent_type?: string;
  parent_id?: string;
  name?: string;
  parent_name?: string;
  deleted_by?: string;
  deleted_at?: string;
  cleanup_due_at?: string;
  related_items?: string;
  meta?: Record<string, any>;
  is_restorable?: boolean;

  constructor(data: Partial<BaseTrash>) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    trashId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let trash =
      trashId &&
      (await NocoCache.get(
        context,
        `${CacheScope.TRASH}:${trashId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!trash) {
      trash = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.TRASH,
        trashId,
      );
      if (trash) {
        await NocoCache.set(context, `${CacheScope.TRASH}:${trashId}`, trash);
      }
    }

    return (
      trash &&
      new BaseTrash(prepareForResponse(trash, ['meta', 'related_items']))
    );
  }

  public static async getByResourceId(
    context: NcContext,
    resourceType: string,
    resourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const trash = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      { resource_type: resourceType, resource_id: resourceId },
    );

    return (
      trash &&
      new BaseTrash(prepareForResponse(trash, ['meta', 'related_items']))
    );
  }

  public static async list(
    context: NcContext,
    param: {
      base_id: string;
      resourceType?: string;
      limit?: number;
      offset?: number;
      parentId?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const condition: Record<string, any> = {};

    if (param.resourceType) {
      condition.resource_type = param.resourceType;
    }

    if (param.parentId) {
      condition.parent_id = param.parentId;
    }

    const trashList = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      {
        condition,
        limit: param.limit || 25,
        offset: param.offset || 0,
        orderBy: {
          deleted_at: 'desc',
        },
      },
    );

    const items = trashList.map(
      (t) => new BaseTrash(prepareForResponse(t, ['meta', 'related_items'])),
    );

    // Enrich with is_restorable — false when parent is also in trash
    const parentIds = [
      ...new Set(items.filter((t) => t.parent_id).map((t) => t.parent_id)),
    ];

    let trashedParentIds = new Set<string>();
    if (parentIds.length) {
      const trashedParents = await ncMeta
        .knexConnection(MetaTable.TRASH)
        .where('base_id', context.base_id)
        .whereIn('resource_id', parentIds)
        .select('resource_id');
      trashedParentIds = new Set(
        trashedParents.map((r: { resource_id: string }) => r.resource_id),
      );
    }

    for (const item of items) {
      item.is_restorable =
        !item.parent_id || !trashedParentIds.has(item.parent_id);
    }

    return items;
  }

  public static async count(
    context: NcContext,
    param: {
      base_id: string;
      resourceType?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const condition: Record<string, any> = {};

    if (param.resourceType) {
      condition.resource_type = param.resourceType;
    }

    return await ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      { condition },
    );
  }

  public static async insert(
    context: NcContext,
    data: Partial<BaseTrash>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'fk_workspace_id',
      'base_id',
      'resource_type',
      'resource_id',
      'parent_type',
      'parent_id',
      'name',
      'parent_name',
      'deleted_by',
      'deleted_at',
      'cleanup_due_at',
      'related_items',
      'meta',
    ]);

    prepareForDb(insertObj, ['meta', 'related_items']);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      insertObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
    trashId: string,
    data: Partial<BaseTrash>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(data, ['related_items']);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      updateObj,
      trashId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.TRASH}:${trashId}`,
      updateObj,
    );

    return this.get(context, trashId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    trashId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await NocoCache.deepDel(
      context,
      `${CacheScope.TRASH}:${trashId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      trashId,
    );
  }

  public static async deleteByResourceId(
    context: NcContext,
    resourceType: string,
    resourceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const trash = await this.getByResourceId(
      context,
      resourceType,
      resourceId,
      ncMeta,
    );

    if (trash) {
      return this.delete(context, trash.id, ncMeta);
    }
  }

  public static async deleteAllForBase(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const trashEntries = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      { condition: {} },
    );

    for (const entry of trashEntries) {
      await NocoCache.deepDel(
        context,
        `${CacheScope.TRASH}:${entry.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.TRASH,
        entry.id,
      );
    }
  }

  /**
   * Recalculate cleanup_due_at for all trash entries in a workspace.
   * Call this when the workspace plan changes.
   */
  public static async recalculateCleanupDueAt(
    workspaceId: string,
    retentionDays: number,
    ncMeta = Noco.ncMeta,
  ) {
    const query = ncMeta.knexConnection(MetaTable.TRASH);
    const client = query.client.config.client;

    let dateExpr: string;

    if (client === 'pg') {
      dateExpr = `deleted_at + interval '${retentionDays} days'`;
    } else if (client === 'mysql' || client === 'mysql2') {
      dateExpr = `DATE_ADD(deleted_at, INTERVAL ${retentionDays} DAY)`;
    } else if (client === 'sqlite3') {
      dateExpr = `datetime(deleted_at, '+${retentionDays} days')`;
    } else {
      throw new Error(`Unsupported DB client: ${client}`);
    }

    await query.where('fk_workspace_id', workspaceId).update({
      cleanup_due_at: ncMeta.knexConnection.raw(dateExpr),
    });
  }

  public getRelatedItems(): {
    columns?: Array<{ id: string; placeholder_id: string; table_id: string }>;
  } {
    if (!this.related_items) return {};
    if (typeof this.related_items === 'object') return this.related_items;

    try {
      return JSON.parse(this.related_items);
    } catch {
      return {};
    }
  }
}
