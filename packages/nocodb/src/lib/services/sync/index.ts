import { T } from 'nc-help';
import { PagedResponseImpl } from '../../meta/helpers/PagedResponse';
import { Project, SyncSource } from '../../models';

export async function syncSourceList(param: {
  projectId: string;
  baseId?: string;
}) {
  return new PagedResponseImpl(
    await SyncSource.list(param.projectId, param.baseId)
  );
}

export async function syncCreate(param: {
  projectId: string;
  baseId?: string;
  userId: string;
  // todo: define type
  syncPayload: Partial<SyncSource>;
}) {
  T.emit('evt', { evt_type: 'webhooks:created' });
  const project = await Project.getWithInfo(param.projectId);

  const sync = await SyncSource.insert({
    ...param.syncPayload,
    fk_user_id: param.userId,
    base_id: param.baseId ? param.baseId : project.bases[0].id,
    project_id: param.projectId,
  });
  return sync;
}

export async function syncDelete(param: { syncId: string }) {
  T.emit('evt', { evt_type: 'webhooks:deleted' });
  return await SyncSource.delete(param.syncId);
}

export async function syncUpdate(param: {
  syncId: string;
  syncPayload: Partial<SyncSource>;
}) {
  T.emit('evt', { evt_type: 'webhooks:updated' });

  return await SyncSource.update(param.syncId, param.syncPayload);
}

export { default as airtableImportJob } from './helpers/job';
