// @ts-ignore
import catchError, { NcError } from '../../helpers/catchError';
import { Router } from 'express';
import Model from '../../../models/Model';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import getSwaggerJSON from './helpers/getSwaggerJSON';
import Project from '../../../models/Project';
import getSwaggerHtml from './swaggerHtml';
import getRedocHtml from './redocHtml';

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

function swaggerHtml(req, res) {
  res.send(getSwaggerHtml(req.ncSiteUrl));
}

function redocHtml(req, res) {
  res.send(getRedocHtml(req.ncSiteUrl));
}

const router = Router({ mergeParams: true });

// todo: auth
router.get(
  '/api/v1/db/meta/projects/:projectId/swagger.json',
  ncMetaAclMw(swaggerJson, 'swaggerJson')
);

router.get('/api/v1/db/meta/projects/:projectId/swagger', swaggerHtml);

router.get('/api/v1/db/meta/projects/:projectId/redoc', redocHtml);

export default router;
