// @ts-ignore
import catchError from '../../helpers/catchError';
import { Router } from 'express';
import Model from '../../../../noco-models/Model';
import getSwaggerJSON from '../../../../swagger/getSwaggerJSON';
import Project from '../../../../noco-models/Project';
import swaggerHtml from './swaggerHtml';
async function swaggerJson(req, res) {
  const project = await Project.get(req.params.projectId);
  const models = await Model.list({
    project_id: req.params.project_id,
    base_id: null
  });

  const swagger = await getSwaggerJSON(project, models);
  res.json(swagger);
}
const router = Router({ mergeParams: true });

// todo: auth
router.get(
  '/api/v1/db/meta/projects/:projectId/swagger.json',
  catchError(swaggerJson)
);
router.get('/api/v1/db/meta/projects/:projectId/swagger', (_req, res) =>
  res.send(swaggerHtml)
);

export default router;
