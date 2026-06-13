import {
  type NcContext,
  type TableSyncMappingRole,
  type TableSyncMappingType,
} from 'nocodb-sdk';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';

const SRC_TABLE_NS = 'srcTbl';

const srcTableListKey = (ws: string, base: string, tbl: string) =>
  `${CacheScope.TABLE_SYNC_MAPPING}:${SRC_TABLE_NS}:${ws}:${base}:${tbl}:list`;

export default class TableSyncMapping implements TableSyncMappingType {
  id: string;
  base_id: string;
  fk_workspace_id: string;

  fk_table_sync_id: string;

  source_workspace_id: string;
  source_base_id: string;
  source_table_id: string;
  source_view_id: string;
  source_uuid: string;
  source_password_hash: string | null;

  dest_base_id: string;
  dest_table_id: string;

  role: TableSyncMappingRole;

  created_at: string;
  updated_at: string;

  constructor(data: Partial<TableSyncMapping>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    mapping: Partial<TableSyncMapping>,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncMapping> {
    const insertObj = extractProps(mapping, [
      'fk_table_sync_id',
      'source_workspace_id',
      'source_base_id',
      'source_table_id',
      'source_view_id',
      'source_uuid',
      'source_password_hash',
      'dest_base_id',
      'dest_table_id',
      'role',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNC_MAPPINGS,
      insertObj,
    );

    const res = await this.get(context, id, ncMeta);

    await NocoCache.appendToList(
      context,
      CacheScope.TABLE_SYNC_MAPPING,
      [insertObj.fk_table_sync_id],
      `${CacheScope.TABLE_SYNC_MAPPING}:${id}`,
    );

    if (insertObj.source_table_id) {
      await NocoCache.del(
        'root',
        srcTableListKey(
          insertObj.source_workspace_id,
          insertObj.source_base_id,
          insertObj.source_table_id,
        ),
      );
    }

    return res;
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncMapping | null> {
    const key = `${CacheScope.TABLE_SYNC_MAPPING}:${id}`;
    let row = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);
    if (!row) {
      row = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.TABLE_SYNC_MAPPINGS,
        id,
      );
      if (!row) return null;
      await NocoCache.set(context, key, row);
    }
    return new TableSyncMapping(row);
  }

  /** All mappings for a single sync (1 main + N linked_shadow rows). */
  public static async listBySyncId(
    context: NcContext,
    fk_table_sync_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncMapping[]> {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.TABLE_SYNC_MAPPING,
      [fk_table_sync_id],
    );
    let { list: rows } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !rows.length) {
      rows = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.TABLE_SYNC_MAPPINGS,
        { condition: { fk_table_sync_id } },
      );
      await NocoCache.setList(
        context,
        CacheScope.TABLE_SYNC_MAPPING,
        [fk_table_sync_id],
        rows,
      );
    }
    return rows.map((r) => new TableSyncMapping(r));
  }

  /** Dispatcher hot path — given a source `(workspace, base, table)` tuple,
   *  find every mapping that should fire. All three are part of the key:
   *  - `workspace`: cross-workspace syncs are supported (mapping's own
   *    `fk_workspace_id` is the destination workspace, which can differ);
   *  - `base`: sandbox bases preserve master IDs by design (composite PK on
   *    `nc_models = [base_id, id]`), so the same `table_id` can legitimately
   *    exist in multiple bases.
   *
   *  Result is root-scoped cached — 99% of source tables have no mappings,
   *  and the empty list is stored as a `'NONE'` tombstone so the hot path
   *  short-circuits without a DB roundtrip.
   */
  public static async listBySourceTable(
    source_workspace_id: string,
    source_base_id: string,
    source_table_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncMapping[]> {
    const subKeys = [
      SRC_TABLE_NS,
      source_workspace_id,
      source_base_id,
      source_table_id,
    ];
    const cachedList = await NocoCache.getList(
      'root',
      CacheScope.TABLE_SYNC_MAPPING,
      subKeys,
    );
    let { list: rows } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !rows.length) {
      rows = await ncMeta.knexConnection(MetaTable.TABLE_SYNC_MAPPINGS).where({
        source_workspace_id,
        source_base_id,
        source_table_id,
      });
      await NocoCache.setList(
        'root',
        CacheScope.TABLE_SYNC_MAPPING,
        subKeys,
        rows,
      );
    }
    return rows.map((r) => new TableSyncMapping(r));
  }

  /** All mappings whose destination table is the given table. Used when a
   *  synced dest table is trashed — root-scoped (knexConnection) because the
   *  mapping row may live in a different base than its dest table. */
  public static async listByDestTable(
    dest_base_id: string,
    dest_table_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncMapping[]> {
    const rows = await ncMeta
      .knexConnection(MetaTable.TABLE_SYNC_MAPPINGS)
      .where({
        dest_base_id,
        dest_table_id,
      });
    return rows.map((r) => new TableSyncMapping(r));
  }

  /** Given a source `(workspace, base, view)` tuple, return every mapping
   *  whose source view is this view. Used by the filter-change subscriber
   *  to find which syncs need a full-resync when a source view's filters
   *  change — filter changes don't bump `LastModifiedTime` on rows, so the
   *  incremental cursor path can't catch them; only a full-fetch + tombstone
   *  sweep can. */
  public static async listBySourceView(
    source_workspace_id: string,
    source_base_id: string,
    source_view_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncMapping[]> {
    const rows = await ncMeta
      .knexConnection(MetaTable.TABLE_SYNC_MAPPINGS)
      .where({
        source_workspace_id,
        source_base_id,
        source_view_id,
      });
    return rows.map((r) => new TableSyncMapping(r));
  }

  public static async update(
    context: NcContext,
    id: string,
    patch: Partial<
      Pick<
        TableSyncMapping,
        'source_view_id' | 'source_uuid' | 'source_password_hash'
      >
    >,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncMapping | null> {
    const updateObj = extractProps(patch, [
      'source_view_id',
      'source_uuid',
      'source_password_hash',
    ]);
    if (!Object.keys(updateObj).length) {
      return this.get(context, id, ncMeta);
    }

    const existing = await this.get(context, id, ncMeta);
    if (!existing) return null;

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNC_MAPPINGS,
      updateObj,
      id,
    );

    await NocoCache.update(
      context,
      `${CacheScope.TABLE_SYNC_MAPPING}:${id}`,
      updateObj,
    );

    return this.get(context, id, ncMeta);
  }

  /** Delete a single mapping row by id. Used when removing one link column
   *  from a sync — we drop just that junction (and optionally its shadow)
   *  without affecting the rest of the sync's mappings. */
  public static async deleteById(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const existing = await this.get(context, id, ncMeta);
    if (!existing) return;

    await NocoCache.deepDel(
      context,
      `${CacheScope.TABLE_SYNC_MAPPING}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    if (existing.source_table_id) {
      await NocoCache.del(
        'root',
        srcTableListKey(
          existing.source_workspace_id,
          existing.source_base_id,
          existing.source_table_id,
        ),
      );
    }

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNC_MAPPINGS,
      id,
    );
  }

  public static async deleteBySyncId(
    context: NcContext,
    fk_table_sync_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const list = await this.listBySyncId(context, fk_table_sync_id, ncMeta);

    // Collect distinct source-table list keys to invalidate alongside the
    // per-row deletes. Junction mappings have null source_* fields and
    // don't participate in this index — skip them.
    const sourceTableListKeys = new Set<string>();
    for (const m of list) {
      if (m.source_table_id) {
        sourceTableListKeys.add(
          srcTableListKey(
            m.source_workspace_id,
            m.source_base_id,
            m.source_table_id,
          ),
        );
      }
      await NocoCache.deepDel(
        context,
        `${CacheScope.TABLE_SYNC_MAPPING}:${m.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }
    if (sourceTableListKeys.size) {
      await NocoCache.del('root', [...sourceTableListKeys]);
    }

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNC_MAPPINGS,
      { fk_table_sync_id },
    );
  }
}
