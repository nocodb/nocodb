import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import { syncService } from '../../services';

export async function syncSourceList(req: Request, res: Response) {
  // todo: pagination
  res.json(
    syncService.syncSourceList({
      projectId: req.params.projectId,
    })
  );
}

export async function syncCreate(req: Request, res: Response) {
  res.json(
    await syncService.syncCreate({
      projectId: req.params.projectId,
      baseId: req.params.baseId,
      userId: (req as any).user.id,
      syncPayload: req.body,
    })
  );
}

export async function syncDelete(req: Request, res: Response<any>) {
  res.json(
    await syncService.syncDelete({
      syncId: req.params.syncId,
    })
  );
}

export async function syncUpdate(req: Request, res: Response) {
  res.json(
    await syncService.syncUpdate({
      syncId: req.params.syncId,
      syncPayload: req.body,
    })
  );
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
