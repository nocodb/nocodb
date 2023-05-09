import { Router } from 'express';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import { importService } from '../../services';
import type { Request, Response } from 'express';

export async function importModels(req: Request, res: Response) {
  const { body, ...rest } = req;
  res.json(
    await importService.importModels({
      user: (req as any).user,
      projectId: req.params.projectId,
      baseId: req.params.baseId,
      data: Array.isArray(body) ? body : body.models,
      req: rest,
    })
  );
}

export async function importBase(req: Request, res: Response) {
  const { body, ...rest } = req;
  res.json(
    await importService.importBase({
      user: (req as any).user,
      projectId: req.params.projectId,
      baseId: req.params.baseId,
      src: body.src,
      req: rest,
    })
  );
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/meta/import/:projectId/:baseId',
  ncMetaAclMw(importBase, 'importBase')
);

export default router;
