import { Request, Response, Router } from 'express';
import { OrgUserRoles } from '../../../enums/OrgUserRoles';
import ApiToken from '../../models/ApiToken';
import { Tele } from '../../utils/Tele';
import { metaApiMetrics } from '../helpers/apiMetrics';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { PagedResponseImpl } from '../helpers/PagedResponse';

async function apiTokenList(req, res) {
  res.json(
    new PagedResponseImpl(await ApiToken.listWithCreatedBy(req.query), {
      ...req.query,
      count: await ApiToken.count(),
    })
  );
}

export async function apiTokenCreate(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'org:apiToken:created' });
  res.json(await ApiToken.insert({ ...req.body, fk_user_id: req['user'].id }));
}

export async function apiTokenDelete(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'org:apiToken:deleted' });
  res.json(await ApiToken.delete(req.params.token));
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/tokens',
  metaApiMetrics,
  ncMetaAclMw(apiTokenList, 'apiTokenList', {
    allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
);
router.post(
  '/api/v1/tokens',
  metaApiMetrics,
  ncMetaAclMw(apiTokenCreate, 'apiTokenCreate', {
    allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
);
router.delete(
  '/api/v1/tokens/:token',
  metaApiMetrics,
  ncMetaAclMw(apiTokenDelete, 'apiTokenDelete', {
    allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
);
export default router;
