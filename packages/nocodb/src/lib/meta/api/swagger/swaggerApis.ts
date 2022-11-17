// @ts-ignore
import catchError, { NcError } from '../../helpers/catchError';
import { Router } from 'express';
import Model from '../../../models/Model';
import ncMetaAclMw from '../../helpers/ncMetaAclMw'
import getSwaggerJSON from './helpers/getSwaggerJSON';
import Project from '../../../models/Project';
import swaggerHtml from './swaggerHtml';
import redocHtml from './redocHtml';

async function swaggerJson(req, res) {
  const project = await Project.get(req.params.projectId);

  if (!project) NcError.notFound();

  const models = await Model.list({
    project_id: req.params.projectId,
    base_id: null,
  });

  const swagger = await getSwaggerJSON(project, models);

  swagger.servers = [
    {
      url: req.ncSiteUrl,
    },
    {
      url: '{customUrl}',
      variables: {
        customUrl: {
          default: req.ncSiteUrl,
          description: 'Provide custom nocodb app base url',
        },
      },
    },
  ] as any;

  res.json(swagger);
}

const router = Router({ mergeParams: true });

// todo: auth
router.get(
  '/api/v1/db/meta/projects/:projectId/swagger.json',
  ncMetaAclMw(swaggerJson, 'swaggerJson')
);
router.get('/api/v1/db/meta/projects/:projectId/swagger', (_req, res) =>
  res.send(swaggerHtml)
);
router.get('/api/v1/db/meta/projects/:projectId/redoc', (_req, res) =>
  res.send(redocHtml)
);

export default router;
