import { Router } from 'express';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import { exportService } from '../../services';
import type { Request, Response } from 'express';

export async function exportModel(req: Request, res: Response) {
  res.json(
    await exportService.exportModel({ modelId: req.params.modelId.split(',') })
  );
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/meta/export/:modelId',
  ncMetaAclMw(exportModel, 'exportModel')
);

export default router;
