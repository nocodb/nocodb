import { Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { metaDiffService } from '../services';

export async function metaDiff(req, res) {
  res.json(await metaDiffService.metaDiff({ projectId: req.params.projectId }));
}

export async function baseMetaDiff(req, res) {
  res.json(
    await metaDiffService.baseMetaDiff({
      baseId: req.params.baseId,
      projectId: req.params.projectId,
    })
  );
}

export async function metaDiffSync(req, res) {
  await metaDiffService.metaDiffSync({ projectId: req.params.projectId });
  res.json({ msg: 'The meta has been synchronized successfully' });
}

export async function baseMetaDiffSync(req, res) {
  await metaDiffService.baseMetaDiffSync({
    projectId: req.params.projectId,
    baseId: req.params.baseId,
  });

  res.json({ msg: 'The base meta has been synchronized successfully' });
}

const router = Router();
router.get(
  '/api/v1/db/meta/projects/:projectId/meta-diff',
  metaApiMetrics,
  ncMetaAclMw(metaDiff, 'metaDiff')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/meta-diff',
  metaApiMetrics,
  ncMetaAclMw(metaDiffSync, 'metaDiffSync')
);
router.get(
  '/api/v1/db/meta/projects/:projectId/meta-diff/:baseId',
  metaApiMetrics,
  ncMetaAclMw(baseMetaDiff, 'baseMetaDiff')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/meta-diff/:baseId',
  metaApiMetrics,
  ncMetaAclMw(baseMetaDiffSync, 'baseMetaDiffSync')
);
export default router;
