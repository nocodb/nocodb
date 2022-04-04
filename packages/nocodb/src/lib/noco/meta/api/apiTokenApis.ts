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

router.get('/projects/:projectId/apiTokens', ncMetaAclMw(apiTokenList));
router.post('/projects/:projectId/apiTokens', ncMetaAclMw(apiTokenCreate));
router.delete(
  '/projects/:projectId/apiTokens/:token',
  ncMetaAclMw(apiTokenDelete)
);

export default router;
