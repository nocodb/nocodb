import { Router } from 'express';
import { OrgUserRoles } from 'nocodb-sdk';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { orgLicenseService } from '../services';

async function licenseGet(_req, res) {
  res.json(await orgLicenseService.licenseGet());
}

async function licenseSet(req, res) {
  await orgLicenseService.licenseSet({ key: req.body.key });
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
