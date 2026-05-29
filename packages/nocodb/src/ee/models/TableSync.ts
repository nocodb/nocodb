import {
  type NcContext,
  TableSyncInputMode,
  TableSyncOnDeleteAction,
  TableSyncStatus,
  type TableSyncTrigger,
  type TableSyncType,
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
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import TableSyncMapping from '~/ee/models/TableSyncMapping';
import TableSyncColumnMapping from '~/ee/models/TableSyncColumnMapping';

const JSON_FIELDS = ['selected_fields'];

export default class TableSync implements TableSyncType {
  id: string;
  base_id: string;
  fk_workspace_id: string;

  title: string;

  selected_fields: string[] | null;

  on_delete_action: TableSyncOnDeleteAction;
  sync_trigger: TableSyncTrigger;

  source_input_mode: TableSyncInputMode;

  status: TableSyncStatus;
  last_error: string | null;
  last_synced_at: string | null;
  sync_job_id: string | null;

  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  mappings?: TableSyncMapping[];

  constructor(data: Partial<TableSync>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    sync: Partial<TableSync>,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSync> {
    const insertObj = extractProps(sync, [
      'title',
      'selected_fields',
      'on_delete_action',
      'sync_trigger',
      'source_input_mode',
      'status',
      'last_error',
      'last_synced_at',
      'sync_job_id',
      'created_by',
      'updated_by',
    ]);

    if (!insertObj.status) insertObj.status = TableSyncStatus.Active;
    if (!insertObj.on_delete_action) {
      insertObj.on_delete_action = TableSyncOnDeleteAction.MarkDeleted;
    }
    if (!insertObj.source_input_mode) {
      insertObj.source_input_mode = TableSyncInputMode.Browse;
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNCS,
      prepareForDb(insertObj, JSON_FIELDS),
    );

    return this.get(context, id, ncMeta);
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSync | null> {
    const key = `${CacheScope.TABLE_SYNC}:${id}`;
    let row = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);
    if (!row) {
      row = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.TABLE_SYNCS,
        id,
      );
      if (!row) return null;
      await NocoCache.set(context, key, prepareForResponse(row, JSON_FIELDS));
    }
    const sync = new TableSync(row);
    sync.mappings = await TableSyncMapping.listBySyncId(
      context,
      sync.id,
      ncMeta,
    );
    return sync;
  }

  public static async list(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSync[]> {
    if (!context.base_id || !context.workspace_id) return [];

    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNCS,
      {},
    );

    const syncs = rows.map(
      (row) => new TableSync(prepareForResponse(row, JSON_FIELDS)),
    );

    for (const sync of syncs) {
      sync.mappings = await TableSyncMapping.listBySyncId(
        context,
        sync.id,
        ncMeta,
      );
    }

    return syncs;
  }

  public static async update(
    context: NcContext,
    id: string,
    patch: Partial<TableSync>,
    ncMeta = Noco.ncMeta,
  ): Promise<TableSync> {
    const updateObj = extractProps(patch, [
      'title',
      'selected_fields',
      'on_delete_action',
      'sync_trigger',
      'status',
      'last_error',
      'last_synced_at',
      'sync_job_id',
      'updated_by',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNCS,
      prepareForDb(updateObj, JSON_FIELDS),
      id,
    );

    await NocoCache.update(
      context,
      `${CacheScope.TABLE_SYNC}:${id}`,
      prepareForResponse(updateObj, JSON_FIELDS),
    );

    return this.get(context, id, ncMeta);
  }

  public static async delete(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    await TableSyncColumnMapping.deleteBySyncId(context, id, ncMeta);
    await TableSyncMapping.deleteBySyncId(context, id, ncMeta);
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_SYNCS,
      id,
    );
    await NocoCache.deepDel(
      context,
      `${CacheScope.TABLE_SYNC}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    return true;
  }
}
