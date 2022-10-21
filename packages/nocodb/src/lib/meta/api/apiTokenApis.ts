import { Request, Response, Router } from 'express';
import { Tele } from '../../utils/Tele';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import ApiToken from '../../models/ApiToken';
import { metaApiMetrics } from '../helpers/apiMetrics';

export async function apiTokenList(_req: Request, res: Response) {
  res.json(await ApiToken.list());
}
export async function apiTokenCreate(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'apiToken:created' });
  res.json(await ApiToken.insert(req.body));
}
export async function apiTokenDelete(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'apiToken:deleted' });
  // todo: verify token belongs to the user
  res.json(await ApiToken.delete(req.params.token));
}

// todo: add reset token api to regenerate token

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
