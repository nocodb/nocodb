import { Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { getAjvValidatorMw } from '../meta/api/helpers';
import { modelVisibilityService } from '../services';

async function xcVisibilityMetaSetAll(req, res) {
  await modelVisibilityService.xcVisibilityMetaSetAll({
    visibilityRule: req.body,
    projectId: req.params.projectId,
  });

  res.json({ msg: 'success' });
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/projects/:projectId/visibility-rules',
  metaApiMetrics,
  ncMetaAclMw(async (req, res) => {
    res.json(
      await modelVisibilityService.xcVisibilityMetaGet({
        projectId: req.params.projectId,
        includeM2M:
          req.query.includeM2M === true || req.query.includeM2M === 'true',
      })
    );
  }, 'modelVisibilityList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/visibility-rules',
  metaApiMetrics,
  getAjvValidatorMw('swagger.json#/components/schemas/VisibilityRuleReq'),
  ncMetaAclMw(xcVisibilityMetaSetAll, 'modelVisibilitySet')
);
export default router;
