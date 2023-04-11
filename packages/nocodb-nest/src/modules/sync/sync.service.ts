import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import { Project, SyncSource } from '../../models';

@Injectable()
export class SyncService {
  async syncSourceList(param: { projectId: string; baseId?: string }) {
    return new PagedResponseImpl(
      await SyncSource.list(param.projectId, param.baseId),
    );
  }

  async syncCreate(param: {
    projectId: string;
    baseId?: string;
    userId: string;
    syncPayload: Partial<SyncSource>;
  }) {
    T.emit('evt', { evt_type: 'syncSource:created' });
    const project = await Project.getWithInfo(param.projectId);

    const sync = await SyncSource.insert({
      ...param.syncPayload,
      fk_user_id: param.userId,
      base_id: param.baseId ? param.baseId : project.bases[0].id,
      project_id: param.projectId,
    });
    return sync;
  }

  async syncDelete(param: { syncId: string }) {
    T.emit('evt', { evt_type: 'syncSource:deleted' });
    return await SyncSource.delete(param.syncId);
  }

  async syncUpdate(param: {
    syncId: string;
    syncPayload: Partial<SyncSource>;
  }) {
    T.emit('evt', { evt_type: 'syncSource:updated' });

    return await SyncSource.update(param.syncId, param.syncPayload);
  }
}
