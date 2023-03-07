import type { Request, Response } from 'express';
import { Router } from 'express';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { getConditionalHandler } from '../meta/helpers/getHandler';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { orgTokenService, orgTokenServiceEE } from '../services';

async function apiTokenList(req, res) {
  res.json(
    await getConditionalHandler(
      orgTokenService.apiTokenList,
      orgTokenServiceEE.apiTokenListEE
    )({
      query: req.query,
      user: req['user'],
    })
  );
}

export async function apiTokenCreate(req: Request, res: Response) {
  res.json(
    await orgTokenService.apiTokenCreate({
      apiToken: req.body,
      user: req['user'],
    })
  );
}

export async function apiTokenDelete(req: Request, res: Response) {
  res.json(
    await orgTokenService.apiTokenDelete({
      token: req.params.token,
      user: req['user'],
    })
  );
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/tokens',
  metaApiMetrics,
  ncMetaAclMw(apiTokenList, 'apiTokenList', {
    // allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
);
router.post(
  '/api/v1/tokens',
  metaApiMetrics,
  ncMetaAclMw(apiTokenCreate, 'apiTokenCreate', {
    // allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
);
router.delete(
  '/api/v1/tokens/:token',
  metaApiMetrics,
  ncMetaAclMw(apiTokenDelete, 'apiTokenDelete', {
    // allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
);
export default router;
