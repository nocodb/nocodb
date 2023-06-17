import { Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { modelVisibilityService } from '../services';

async function xcVisibilityMetaSetAll(req, res) {
  await modelVisibilityService.xcVisibilityMetaSetAll({
    visibilityRule: req.body,
    projectId: req.params.projectId,
  });

  res.json({ msg: 'UI ACL has been created successfully' });
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
  ncMetaAclMw(xcVisibilityMetaSetAll, 'modelVisibilitySet')
);
export default router;
