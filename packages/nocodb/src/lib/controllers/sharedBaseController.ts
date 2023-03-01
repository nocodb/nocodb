import { Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { getAjvValidatorMw } from '../meta/api/helpers';
import { sharedBaseService } from '../services';

async function createSharedBaseLink(req, res): Promise<any> {
  const sharedBase = await sharedBaseService.createSharedBaseLink({
    projectId: req.params.projectId,
    roles: req.body?.roles,
    password: req.body?.password,
    siteUrl: req.ncSiteUrl,
  });

  res.json(sharedBase);
}

async function updateSharedBaseLink(req, res): Promise<any> {
  const sharedBase = await sharedBaseService.updateSharedBaseLink({
    projectId: req.params.projectId,
    roles: req.body?.roles,
    password: req.body?.password,
    siteUrl: req.ncSiteUrl,
  });

  res.json(sharedBase);
}

async function disableSharedBaseLink(req, res): Promise<any> {
  const sharedBase = await sharedBaseService.disableSharedBaseLink({
    projectId: req.params.projectId,
  });

  res.json(sharedBase);
}

async function getSharedBaseLink(req, res): Promise<any> {
  const sharedBase = await sharedBaseService.getSharedBaseLink({
    projectId: req.params.projectId,
    siteUrl: req.ncSiteUrl,
  });

  res.json(sharedBase);
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/projects/:projectId/shared',
  ncMetaAclMw(getSharedBaseLink, 'getSharedBaseLink')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/shared',
  getAjvValidatorMw('swagger.json#/components/schemas/SharedBaseReq'),
  ncMetaAclMw(createSharedBaseLink, 'createSharedBaseLink')
);
router.patch(
  '/api/v1/db/meta/projects/:projectId/shared',
  getAjvValidatorMw('swagger.json#/components/schemas/SharedBaseReq'),
  ncMetaAclMw(updateSharedBaseLink, 'updateSharedBaseLink')
);
router.delete(
  '/api/v1/db/meta/projects/:projectId/shared',
  ncMetaAclMw(disableSharedBaseLink, 'disableSharedBaseLink')
);
export default router;
