import { Router } from 'express';
import { OrgUserRoles } from 'nocodb-sdk';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { orgCustomizationService } from '../services';

async function customizationGet(_req, res) {
  res.json(await orgCustomizationService.customizationGet());
}

async function customizationSet(req, res) {
  await orgCustomizationService.customizationSet({ css: req.body.css || '', js: req.body.js || '' });
  res.json({ msg: 'The customization has been saved' });
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/customization',
  metaApiMetrics,
  customizationGet
);
router.post(
  '/api/v1/customization',
  metaApiMetrics,
  ncMetaAclMw(customizationSet, 'customizationSet', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);

export default router;
