import Noco from '../Noco';
import { MetaTable } from '../utils/globals';
import { extractProps } from '../helpers/extractProps';

export default class SyncLogs {
  id?: string;
  project_id?: string;
  fk_sync_source_id?: string;
  time_taken?: string;
  status?: string;
  status_details?: string;

  constructor(syncLog: Partial<SyncLogs>) {
    Object.assign(this, syncLog);
  }

  static async list(projectId: string, ncMeta = Noco.ncMeta) {
    const syncLogs = await ncMeta.metaList(null, null, MetaTable.SYNC_LOGS, {
      condition: {
        project_id: projectId,
      },
      orderBy: {
        created_at: 'asc',
      },
    });
    return syncLogs?.map((h) => new SyncLogs(h));
  }

  public static async insert(syncLog: Partial<SyncLogs>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(syncLog, [
      'project_id',
      'fk_sync_source_id',
      'time_taken',
      'status',
      'status_details',
    ]);

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.SYNC_LOGS,
      insertObj
    );
    return new SyncLogs({ ...insertObj, id });
  }

  static async delete(syncLogId: any, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaDelete(null, null, MetaTable.SYNC_LOGS, syncLogId);
  }
}
