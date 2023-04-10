import { Router } from 'express';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import { exportService } from '../../services';
import type { Request, Response } from 'express';

export async function exportBaseSchema(req: Request, res: Response) {
  res.json(
    await exportService.exportBaseSchema({ baseId: req.params.baseId })
  );
}

export async function exportModelData(req: Request, res: Response) {
  res.json(
    await exportService.exportModelData({ projectId: req.params.projectId, modelId: req.params.modelId, viewId: req.params.viewId })
  );
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/meta/export/:projectId/:baseId',
  ncMetaAclMw(exportBaseSchema, 'exportBaseSchema')
);

router.get(
  '/api/v1/db/meta/export/data/:projectId/:modelId/:viewId?',
  ncMetaAclMw(exportModelData, 'exportModelData')
);

export default router;
