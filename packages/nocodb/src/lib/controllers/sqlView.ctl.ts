import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { sqlViewService } from '../services';

export async function sqlViewCreate(
  req: Request<any, any, any>,
  res: Response<any>
) {
  const table = await sqlViewService.sqlViewCreate({
    clientIp: (req as any).clientIp,
    body: req.body,
    projectId: req.params.projectId,
    baseId: req.params.baseId,
    user: (req as any)?.session?.passport?.user,
  });
  res.json(table);
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/meta/projects/:projectId/bases/:baseId/sqlView',
  metaApiMetrics,
  ncMetaAclMw(sqlViewCreate, 'sqlViewCreate')
);

export default router;
