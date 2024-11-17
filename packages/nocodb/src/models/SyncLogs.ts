import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';

export default class SyncLogs {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_sync_source_id?: string;
  time_taken?: string;
  status?: string;
  status_details?: string;

  constructor(syncLog: Partial<SyncLogs>) {
    Object.assign(this, syncLog);
  }

  static async list(context: NcContext, baseId: string, ncMeta = Noco.ncMeta) {
    const syncLogs = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_LOGS,
      {
        condition: {
          base_id: baseId,
        },
        orderBy: {
          created_at: 'asc',
        },
      },
    );
    return syncLogs?.map((h) => new SyncLogs(h));
  }

  public static async insert(
    context: NcContext,
    syncLog: Partial<SyncLogs>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(syncLog, [
      'base_id',
      'fk_sync_source_id',
      'time_taken',
      'status',
      'status_details',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_LOGS,
      insertObj,
    );
    return new SyncLogs({ ...insertObj, id });
  }
}
