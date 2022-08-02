import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import ApiToken from '../../models/ApiToken';
import { Tele } from 'nc-help';
import { metaApiMetrics } from '../helpers/apiMetrics';

export async function apiTokenList(req: Request, res: Response) {
  res.json(
    await ApiToken.list(
      req['session']?.passport?.user?.id,
      req['session']?.passport?.user?.roles
    )
  );
}
export async function apiTokenCreate(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'apiToken:created' });
  res.json(
    await ApiToken.insert({
      ...req.body,
      user_id: req['session']?.passport?.user?.id,
    })
  );
}
export async function apiTokenDelete(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'apiToken:deleted' });
  res.json(
    await ApiToken.delete(
      req.params.token,
      req['session']?.passport?.user?.id,
      req['session']?.passport?.user?.roles
    )
  );
}

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
