import type { Request, Response } from 'express';
import { Router } from 'express';
import catchError from '../../meta/helpers/catchError';
import { publicMetaService } from '../../services';

export async function viewMetaGet(req: Request, res: Response) {
  res.json(
    await publicMetaService.viewMetaGet({
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: req.params.sharedViewUuid,
    })
  );
}

async function publicSharedBaseGet(req, res): Promise<any> {
  res.json(
    await publicMetaService.publicSharedBaseGet({
      sharedBaseUuid: req.params.sharedBaseUuid,
    })
  );
}

async function getPublicProject(req, res): Promise<any> {
  res.json(
    await publicMetaService.getPublicProject({
      id: req.params.id,
    })
  );
}

async function publicSharedErdGet(req, res): Promise<any> {
  res.json(
    await publicMetaService.publicSharedErdGet({
      sharedErdUuid: req.params.sharedErdUuid,
    })
  );
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/meta',
  catchError(viewMetaGet)
);

router.get(
  '/api/v1/db/public/shared-base/:sharedBaseUuid/meta',
  catchError(publicSharedBaseGet)
);

router.get('/api/v1/db/public/project/:id', catchError(getPublicProject));

router.get(
  '/api/v1/db/public/shared-erd/:sharedErdUuid/meta',
  catchError(publicSharedErdGet)
);

export default router;
