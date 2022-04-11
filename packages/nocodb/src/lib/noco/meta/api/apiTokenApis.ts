import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import ApiToken from '../../../noco-models/ApiToken';
import { Tele } from 'nc-help';

export async function apiTokenList(_req: Request, res: Response) {
  res.json(await ApiToken.list());
}
export async function apiTokenCreate(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'apiToken:created' });
  res.json(await ApiToken.insert(req.body));
}
export async function apiTokenDelete(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'apiToken:deleted' });
  res.json(await ApiToken.delete(req.params.token));
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/meta/projects/:projectId/apiTokens',
  ncMetaAclMw(apiTokenList, 'apiTokenList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/apiTokens',
  ncMetaAclMw(apiTokenCreate, 'apiTokenCreate')
);
router.delete(
  '/api/v1/db/meta/projects/:projectId/apiTokens/:token',
  ncMetaAclMw(apiTokenDelete, 'apiTokenDelete')
);

export default router;
