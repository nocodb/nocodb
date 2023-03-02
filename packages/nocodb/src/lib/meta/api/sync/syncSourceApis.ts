import { Request, Response, Router } from 'express';

import SyncSource from '../../../models/SyncSource';
import { T } from 'nc-help';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import Project from '../../../models/Project';

export async function syncSourceList(req: Request, res: Response) {
  // todo: pagination
  res.json(
    new PagedResponseImpl(
      await SyncSource.list(req.params.projectId, req.params.baseId)
    )
  );
}

export async function syncCreate(req: Request, res: Response) {
  T.emit('evt', { evt_type: 'webhooks:created' });
  const project = await Project.getWithInfo(req.params.projectId);

  const sync = await SyncSource.insert({
    ...req.body,
    fk_user_id: (req as any).user.id,
    base_id: req.params.baseId ? req.params.baseId : project.bases[0].id,
    project_id: req.params.projectId,
  });
  res.json(sync);
}

export async function syncDelete(req: Request, res: Response<any>) {
  T.emit('evt', { evt_type: 'webhooks:deleted' });
  res.json(await SyncSource.delete(req.params.syncId));
}

export async function syncUpdate(req: Request, res: Response) {
  T.emit('evt', { evt_type: 'webhooks:updated' });

  res.json(await SyncSource.update(req.params.syncId, req.body));
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/meta/projects/:projectId/syncs',
  ncMetaAclMw(syncSourceList, 'syncSourceList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/syncs',
  ncMetaAclMw(syncCreate, 'syncSourceCreate')
);
router.get(
  '/api/v1/db/meta/projects/:projectId/syncs/:baseId',
  ncMetaAclMw(syncSourceList, 'syncSourceList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/syncs/:baseId',
  ncMetaAclMw(syncCreate, 'syncSourceCreate')
);
router.delete(
  '/api/v1/db/meta/syncs/:syncId',
  ncMetaAclMw(syncDelete, 'syncSourceDelete')
);
router.patch(
  '/api/v1/db/meta/syncs/:syncId',
  ncMetaAclMw(syncUpdate, 'syncSourceUpdate')
);

export default router;
