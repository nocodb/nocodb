import { Router } from 'express';
import { OrgUserRoles } from 'nocodb-sdk';
import { NC_LICENSE_KEY } from '../../constants'
import Store from '../../models/Store';
import { metaApiMetrics } from '../helpers/apiMetrics';
import ncMetaAclMw from '../helpers/ncMetaAclMw';



async function licenseGet(_req, res) {
  const license = await Store.get(NC_LICENSE_KEY);

  res.json({ key: license?.value });
}

async function licenseSet(req, res) {
  await Store.saveOrUpdate({ value: req.body.key, key: NC_LICENSE_KEY });

  res.json({ msg: 'License key saved' });
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/license',
  metaApiMetrics,
  ncMetaAclMw(licenseGet, 'licenseGet', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.post(
  '/api/v1/license',
  metaApiMetrics,
  ncMetaAclMw(licenseSet, 'licenseSet', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);

export default router;
