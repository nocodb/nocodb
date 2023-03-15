import { Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import { apiTokenService } from '../services';
import type { Request, Response } from 'express';

export async function apiTokenList(req: Request, res: Response) {
  res.json(
    new PagedResponseImpl(
      await apiTokenService.apiTokenList({ userId: req['user'].id })
    )
  );
}

export async function apiTokenCreate(req: Request, res: Response) {
  res.json(
    await apiTokenService.apiTokenCreate({
      tokenBody: req.body,
      userId: req['user'].id,
    })
  );
}

export async function apiTokenDelete(req: Request, res: Response) {
  res.json(
    await apiTokenService.apiTokenDelete({
      token: req.params.token,
      user: req['user'],
    })
  );
}

// todo: add reset token api to regenerate token

// deprecated apis
const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/meta/projects/:projectId/api-tokens',
  metaApiMetrics,
  ncMetaAclMw(apiTokenList, 'apiTokenList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/api-tokens',
  metaApiMetrics,
  ncMetaAclMw(apiTokenCreate, 'apiTokenCreate')
);
router.delete(
  '/api/v1/db/meta/projects/:projectId/api-tokens/:token',
  metaApiMetrics,
  ncMetaAclMw(apiTokenDelete, 'apiTokenDelete')
);

export default router;
