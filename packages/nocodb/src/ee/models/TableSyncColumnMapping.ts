import { type NcContext } from 'nocodb-sdk';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';

const SRC_COL_NS = 'srcCol';

/** Root-scoped list cache key used by `listBySourceColumn` — keyed by
 *  (workspace, base, source column id). Source can live in any workspace
 *  so this can't be context-scoped. Manually invalidated on insert /
 *  deleteById since rows are added to this list via `setList` only (no
 *  `appendToList`), so the framework's parentKeys cascade may not always
 *  cover it depending on call order. */
const srcColListKey = (ws: string, base: string, columnId: string) =>
  `${CacheScope.TABLE_SYNC_COLUMN_MAPPING}:${SRC_COL_NS}:${ws}:${base}:${columnId}:list`;

export default class TableSyncColumnMapping {
  id: string;
  base_id: string;
  fk_workspace_id: string;

  fk_table_sync_id: string;
  fk_table_sync_mapping_id: string;

  source_workspace_id: string;
  source_base_id: string;
  source_table_id: string;
  source_column_id: string;

  dest_base_id: string;
  dest_table_id: string;
  dest_column_id: string;

  created_at: string;
  updated_at: string;

  constructor(data: Partial<TableSyncColumnMapping>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    mapping: Partial<TableSyncColumnMapping>,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncColumnMapping> {
    const insertObj = extractProps(mapping, [
      'fk_table_sync_id',
      'fk_table_sync_mapping_id',
      'source_workspace_id',
      'source_base_id',
      'source_table_id',
      'source_column_id',
      'dest_base_id',
      'dest_table_id',
      'dest_column_id',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNC_COLUMN_MAPPINGS,
      insertObj,
    );

    const res = await this.get(context, id, ncMeta);

    await NocoCache.appendToList(
      context,
      CacheScope.TABLE_SYNC_COLUMN_MAPPING,
      [insertObj.fk_table_sync_mapping_id],
      `${CacheScope.TABLE_SYNC_COLUMN_MAPPING}:${id}`,
    );

    if (insertObj.source_column_id) {
      await NocoCache.del(
        'root',
        srcColListKey(
          insertObj.source_workspace_id,
          insertObj.source_base_id,
          insertObj.source_column_id,
        ),
      );
    }

    return res;
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncColumnMapping | null> {
    const key = `${CacheScope.TABLE_SYNC_COLUMN_MAPPING}:${id}`;
    let row = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);
    if (!row) {
      row = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.TABLE_SYNC_COLUMN_MAPPINGS,
        id,
      );
      if (!row) return null;
      await NocoCache.set(context, key, row);
    }
    return new TableSyncColumnMapping(row);
  }

  public static async listByTableSyncMapping(
    context: NcContext,
    fk_table_sync_mapping_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncColumnMapping[]> {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.TABLE_SYNC_COLUMN_MAPPING,
      [fk_table_sync_mapping_id],
    );
    let { list: rows } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !rows.length) {
      rows = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.TABLE_SYNC_COLUMN_MAPPINGS,
        { condition: { fk_table_sync_mapping_id } },
      );
      await NocoCache.setList(
        context,
        CacheScope.TABLE_SYNC_COLUMN_MAPPING,
        [fk_table_sync_mapping_id],
        rows,
      );
    }
    return rows.map((r) => new TableSyncColumnMapping(r));
  }

  public static async listBySourceColumn(
    source_workspace_id: string,
    source_base_id: string,
    source_column_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncColumnMapping[]> {
    const subKeys = [
      SRC_COL_NS,
      source_workspace_id,
      source_base_id,
      source_column_id,
    ];
    const cachedList = await NocoCache.getList(
      'root',
      CacheScope.TABLE_SYNC_COLUMN_MAPPING,
      subKeys,
    );
    let { list: rows } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !rows.length) {
      rows = await ncMeta
        .knexConnection(MetaTable.TABLE_SYNC_COLUMN_MAPPINGS)
        .where({
          source_workspace_id,
          source_base_id,
          source_column_id,
        });
      await NocoCache.setList(
        'root',
        CacheScope.TABLE_SYNC_COLUMN_MAPPING,
        subKeys,
        rows,
      );
    }
    return rows.map((r) => new TableSyncColumnMapping(r));
  }

  public static async deleteById(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const existing = await this.get(context, id, ncMeta);
    if (!existing) return;

    await NocoCache.deepDel(
      context,
      `${CacheScope.TABLE_SYNC_COLUMN_MAPPING}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    if (existing.source_column_id) {
      await NocoCache.del(
        'root',
        srcColListKey(
          existing.source_workspace_id,
          existing.source_base_id,
          existing.source_column_id,
        ),
      );
    }

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNC_COLUMN_MAPPINGS,
      id,
    );
  }

  /** Find by dest column id — used when a dest column is deleted externally
   *  (e.g. user demoted it then dropped it) and we want to clean up the
   *  mapping row. */
  public static async getByDestColumn(
    context: NcContext,
    dest_column_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSyncColumnMapping | null> {
    const row = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNC_COLUMN_MAPPINGS,
      { dest_column_id },
    );
    if (!row) return null;
    return new TableSyncColumnMapping(row);
  }

  /** Cascade-delete by parent table-mapping (used when an LTAR's junction
   *  or LinkedShadow mapping is dropped). */
  public static async deleteByTableSyncMapping(
    context: NcContext,
    fk_table_sync_mapping_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const rows = await this.listByTableSyncMapping(
      context,
      fk_table_sync_mapping_id,
      ncMeta,
    );
    for (const row of rows) {
      await this.deleteById(context, row.id, ncMeta);
    }
  }

  /** Cascade-delete by sync id (called from `TableSync.delete`). */
  public static async deleteBySyncId(
    context: NcContext,
    fk_table_sync_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNC_COLUMN_MAPPINGS,
      { condition: { fk_table_sync_id } },
    );
    for (const row of rows) {
      await this.deleteById(context, row.id, ncMeta);
    }
  }
}
