import { Router } from 'express';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import { exportService } from '../../services';
import type { Request, Response } from 'express';

export async function exportBase(req: Request, res: Response) {
  res.json(
    await exportService.exportBase({ baseId: req.params.baseId, path: req.body.path })
  );
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/meta/export/:projectId/:baseId',
  ncMetaAclMw(exportBase, 'exportBase')
);

export default router;
