import type { BaseTrashType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import { parseJson } from '~/utils/tsUtils';

function encodeListCursor(deletedAt: string | Date, id: string): string {
  const iso =
    deletedAt instanceof Date
      ? deletedAt.toISOString()
      : new Date(deletedAt).toISOString();
  return `${iso}::${id}`;
}

function decodeListCursor(
  cursor: string | undefined | null,
): { deletedAt: string; id: string } | null {
  if (!cursor) return null;
  const idx = cursor.indexOf('::');
  if (idx <= 0) return null;
  const deletedAtIso = cursor.slice(0, idx);
  const id = cursor.slice(idx + 2);
  if (!id) return null;
  const d = new Date(deletedAtIso);
  if (Number.isNaN(d.getTime())) return null;
  return { deletedAt: d.toISOString(), id };
}

function isUniqueViolation(e: any): boolean {
  if (!e) return false;
  const code =
    e.code ??
    e.original?.code ??
    e.nativeError?.code ??
    e.errno ??
    e.original?.errno ??
    e.nativeError?.errno;
  if (
    code === '23505' || // postgres
    code === 23505 ||
    code === 'ER_DUP_ENTRY' || // mysql
    code === 1062 ||
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    code === 'SQLITE_CONSTRAINT'
  ) {
    return true;
  }
  const msg = String(e.message ?? '');
  return /UNIQUE constraint failed|duplicate key value/i.test(msg);
}

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
  cleanup_due_at?: string | null;
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
    if (!trashId) return null;
    const trash = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      trashId,
    );
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
      {
        fk_workspace_id: context.workspace_id,
        resource_type: resourceType,
        resource_id: resourceId,
      },
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
      cursor?: string | null;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<{ list: BaseTrash[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(param.limit || 25, 100));

    const qb = this.buildBaseListQuery(context, param, ncMeta);

    const decoded = decodeListCursor(param.cursor);
    if (decoded) {
      qb.where(function () {
        this.where(
          `${MetaTable.TRASH}.deleted_at`,
          '<',
          decoded.deletedAt,
        ).orWhere(function () {
          this.where(
            `${MetaTable.TRASH}.deleted_at`,
            '=',
            decoded.deletedAt,
          ).andWhere(`${MetaTable.TRASH}.id`, '<', decoded.id);
        });
      });
    }

    qb.orderBy(`${MetaTable.TRASH}.deleted_at`, 'desc')
      .orderBy(`${MetaTable.TRASH}.id`, 'desc')
      .limit(limit + 1);

    const rows = await qb.select(`${MetaTable.TRASH}.*`);
    const hasMore = rows.length > limit;
    const visible = hasMore ? rows.slice(0, limit) : rows;

    const items = visible.map(
      (t: any) =>
        new BaseTrash(prepareForResponse(t, ['meta', 'related_items'])),
    );

    const last = visible[visible.length - 1];
    const nextCursor =
      hasMore && last ? encodeListCursor(last.deleted_at, last.id) : null;

    return { list: items, nextCursor };
  }

  /**
   * Cascade-cleanup query — returns child trash rows for a given parent
   * regardless of whether the parent is also in trash. The user-facing
   * `list` hides children whose parent is in trash; `permanentDelete`'s
   * cascade needs them, so it uses this direct path.
   */
  public static async listChildrenByParent(
    context: NcContext,
    param: {
      parentId: string;
      resourceType: string;
      limit?: number;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<BaseTrash[]> {
    const limit = Math.max(1, Math.min(param.limit || 100, 500));
    const rows = await ncMeta
      .knexConnection(MetaTable.TRASH)
      .where('fk_workspace_id', context.workspace_id)
      .where('base_id', context.base_id)
      .where('resource_type', param.resourceType)
      .where('parent_id', param.parentId)
      .orderBy('deleted_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .select('*');
    return rows.map(
      (t: any) =>
        new BaseTrash(prepareForResponse(t, ['meta', 'related_items'])),
    );
  }

  /**
   * Shared filter for `list` and `count` — workspace + base scope, optional
   * resource_type, and the parent-trashed exclusion that mirrors Airtable's
   * "hide children while parent is in trash" UX.
   */
  private static buildBaseListQuery(
    context: NcContext,
    param: {
      base_id: string;
      resourceType?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const qb = ncMeta
      .knexConnection(MetaTable.TRASH)
      .where(`${MetaTable.TRASH}.fk_workspace_id`, context.workspace_id)
      .where(`${MetaTable.TRASH}.base_id`, context.base_id);

    if (param.resourceType) {
      qb.where(`${MetaTable.TRASH}.resource_type`, param.resourceType);
    }

    qb.where(function () {
      this.whereNull(`${MetaTable.TRASH}.parent_id`).orWhereNotExists(
        function () {
          this.select(1)
            .from(`${MetaTable.TRASH} as parent`)
            .whereRaw(`parent.resource_id = ${MetaTable.TRASH}.parent_id`)
            .where('parent.fk_workspace_id', context.workspace_id)
            .where('parent.base_id', context.base_id);
        },
      );
    });

    return qb;
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

    // Idempotent on the (base_id, resource_type, resource_id) unique key.
    // Concurrent deletes of the same resource — or retries from the inline
    // record-trash hook — collapse onto the first inserted row instead of
    // surfacing a 500.
    let id: string | undefined;
    try {
      ({ id } = await ncMeta.metaInsert2(
        context.workspace_id,
        context.base_id,
        MetaTable.TRASH,
        insertObj,
      ));
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const existing = await this.getByResourceId(
        context,
        insertObj.resource_type,
        insertObj.resource_id,
        ncMeta,
      );
      if (existing) return existing;
      throw e;
    }

    return this.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
    trashId: string,
    data: Partial<BaseTrash>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(data, [
      'related_items',
      'meta',
      'cleanup_due_at',
    ]);

    prepareForDb(updateObj, ['meta', 'related_items']);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      updateObj,
      trashId,
    );

    return this.get(context, trashId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    trashId: string,
    ncMeta = Noco.ncMeta,
  ) {
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

  /**
   * Bulk-delete trash entries by `(resource_type, resource_id IN [...])`.
   * Used by `RecordTrashHandler.restoreRows` to drop now-empty trash entries
   * in a single round-trip after a per-row restore. Workspace + base scoped
   * via the standard `metaDelete` context filter.
   */
  public static async deleteByResourceIds(
    context: NcContext,
    resourceType: string,
    resourceIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!resourceIds.length) return;
    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      { resource_type: resourceType },
      { resource_id: { in: resourceIds } },
    );
  }

  public static async deleteRecordEntriesForTable(
    context: NcContext,
    tableId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.TRASH,
      { resource_type: 'record' },
      { resource_id: { like: `${tableId}:%` } },
    );
  }

  public static async deleteByBaseId(context: NcContext, ncMeta = Noco.ncMeta) {
    if (!context.workspace_id || !context.base_id) return 0;
    return ncMeta
      .knexConnection(MetaTable.TRASH)
      .where('fk_workspace_id', context.workspace_id)
      .where('base_id', context.base_id)
      .del();
  }

  public getRelatedItems<
    T extends object = {
      columns?: Array<{ id: string; placeholder_id: string; table_id: string }>;
      dependents?: Array<{ id: string; type: string }>;
      /** Sync mappings suspended when a synced table is trashed (App Sync). */
      appSyncMappingIds?: string[];
      /** Sync mappings suspended when a synced table is trashed (Table Sync). */
      tableSyncMappings?: Array<{ id: string; baseId: string }>;
      /**
       * System hm-links on the junction model, soft-deleted alongside a
       * junction-backed link so restore/purge can reactivate them.
       */
      junctionSystemLinks?: Array<{
        id: string;
        base_id: string;
        fk_workspace_id: string;
      }>;
    },
  >(): T {
    return parseJson<T>(this.related_items);
  }
}
