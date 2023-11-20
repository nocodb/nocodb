import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';

export default class SyncLogs {
  id?: string;
  base_id?: string;
  fk_sync_source_id?: string;
  time_taken?: string;
  status?: string;
  status_details?: string;

  constructor(syncLog: Partial<SyncLogs>) {
    Object.assign(this, syncLog);
  }

  static async list(baseId: string, ncMeta = Noco.ncMeta) {
    const syncLogs = await ncMeta.metaList(null, null, MetaTable.SYNC_LOGS, {
      condition: {
        base_id: baseId,
      },
      orderBy: {
        created_at: 'asc',
      },
    });
    return syncLogs?.map((h) => new SyncLogs(h));
  }

  public static async insert(syncLog: Partial<SyncLogs>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(syncLog, [
      'base_id',
      'fk_sync_source_id',
      'time_taken',
      'status',
      'status_details',
    ]);

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.SYNC_LOGS,
      insertObj,
    );
    return new SyncLogs({ ...insertObj, id });
  }

  static async delete(syncLogId: any, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaDelete(null, null, MetaTable.SYNC_LOGS, syncLogId);
  }
}
