import { Router } from 'express';
import { OrgUserRoles } from '../../../enums/OrgUserRoles';
import ApiToken from '../../models/ApiToken';
import { metaApiMetrics } from '../helpers/apiMetrics';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { PagedResponseImpl } from '../helpers/PagedResponse';

async function tokensList(req, res) {
  res.json(
    new PagedResponseImpl(await ApiToken.listWithCreatedBy(req.query), {
      ...req.query,
      count: await ApiToken.count(),
    })
  );
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/tokens',
  metaApiMetrics,
  ncMetaAclMw(tokensList, 'tokensList', [OrgUserRoles.SUPER])
);
export default router;
