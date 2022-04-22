// @ts-ignore
import catchError from '../../helpers/catchError';
import { Request, Router } from 'express';
import Model from '../../../../noco-models/Model';
import getSwaggerJSON from './helpers/getSwaggerJSON';
import Project from '../../../../noco-models/Project';
import swaggerHtml from './swaggerHtml';
import redocHtml from './redocHtml';
const Converter = require('openapi-to-postmanv2');

async function swaggerJson(req, res) {
  const project = await Project.get(req.params.projectId);
  const models = await Model.list({
    project_id: req.params.project_id,
    base_id: null
  });

  const swagger = await getSwaggerJSON(project, models);
  res.json(swagger);
}

async function postmanJson(req: Request, res) {
  const project = await Project.get(req.params.projectId);
  const models = await Model.list({
    project_id: req.params.project_id,
    base_id: null
  });

  const swagger = await getSwaggerJSON(project, models);

  swagger.servers = [
    {
      url: (req as any).ncSiteUrl
    }
  ];

  Converter.convert(
    { type: 'json', data: swagger },
    {},
    (err, conversionResult) => {
      if (err) {
        res.status(400).json({ msg: err });
      }

      if (!conversionResult.result) {
        res
          .status(400)
          .json({ msg: 'Could not convert : ' + conversionResult.reason });
      } else {
        res.json(conversionResult.output[0].data);
      }
    }
  );
}
const router = Router({ mergeParams: true });

// todo: auth
router.get(
  '/api/v1/db/meta/projects/:projectId/swagger.json',
  catchError(swaggerJson)
);
router.get(
  '/api/v1/db/meta/projects/:projectId/postman.json',
  catchError(postmanJson)
);
router.get('/api/v1/db/meta/projects/:projectId/swagger', (_req, res) =>
  res.send(swaggerHtml)
);
router.get('/api/v1/db/meta/projects/:projectId/redoc', (_req, res) =>
  res.send(redocHtml)
);

export default router;
