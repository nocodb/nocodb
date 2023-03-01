import { Request, Response } from 'express';
import Project from '../../models/Project';
import { BaseListType } from 'nocodb-sdk';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { syncBaseMigration } from '../helpers/syncMigration';
import Base from '../../models/Base';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Tele } from 'nc-help';
import { metaApiMetrics } from '../helpers/apiMetrics';
import { populateMeta } from './helpers';

export async function baseGet(
  req: Request<any, any, any>,
  res: Response<Base>
) {
  const base = await Base.get(req.params.baseId);

  base.config = await base.getConnectionConfig();

  res.json(base);
}

export async function baseUpdate(
  req: Request<any, any, any>,
  res: Response<any>
) {
  const baseBody = req.body;
  const project = await Project.getWithInfo(req.params.projectId);
  const base = await Base.updateBase(req.params.baseId, {
    ...baseBody,
    type: baseBody.config?.client,
    projectId: project.id,
    id: req.params.baseId,
  });

  delete base.config;

  Tele.emit('evt', {
    evt_type: 'base:updated',
  });

  res.json(base);
}

export async function baseList(
  req: Request<any, any, any>,
  res: Response<BaseListType>,
  next
) {
  try {
    const bases = await Base.list({ projectId: req.params.projectId });

    res // todo: pagination
      .json({
        bases: new PagedResponseImpl(bases, {
          count: bases.length,
          limit: bases.length,
        }),
      });
  } catch (e) {
    console.log(e);
    next(e);
  }
}

export async function baseDelete(
  req: Request<any, any, any>,
  res: Response<any>
) {
  const base = await Base.get(req.params.baseId);
  const result = await base.delete();
  Tele.emit('evt', { evt_type: 'base:deleted' });
  res.json(result);
}

async function baseCreate(req: Request<any, any>, res) {
  // type | base | projectId
  const baseBody = req.body;
  const project = await Project.getWithInfo(req.params.projectId);
  const base = await Base.createBase({
    ...baseBody,
    type: baseBody.config?.client,
    projectId: project.id,
  });

  await syncBaseMigration(project, base);

  const info = await populateMeta(base, project);

  Tele.emit('evt_api_created', info);

  delete base.config;

  Tele.emit('evt', {
    evt_type: 'base:created',
  });

  res.json(base);
}

async function baseShareErd(req: Request<any, any>, res) {
  const base = await Base.get(req.params.baseId);
  res.json(await base.shareErd());
}

async function baseDisableShareErd(req: Request<any, any>, res) {
  const base = await Base.get(req.params.baseId);
  res.json(await base.disableShareErd());
}

export default (router) => {
  router.get(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId',
    metaApiMetrics,
    ncMetaAclMw(baseGet, 'baseGet')
  );
  router.patch(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId',
    metaApiMetrics,
    ncMetaAclMw(baseUpdate, 'baseUpdate')
  );
  router.delete(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId',
    metaApiMetrics,
    ncMetaAclMw(baseDelete, 'baseDelete')
  );
  router.post(
    '/api/v1/db/meta/projects/:projectId/bases',
    metaApiMetrics,
    ncMetaAclMw(baseCreate, 'baseCreate')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId/bases',
    metaApiMetrics,
    ncMetaAclMw(baseList, 'baseList')
  );
  router.post(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId/share/erd',
    metaApiMetrics,
    ncMetaAclMw(baseShareErd, 'baseShareErd')
  );
  router.delete(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId/share/erd',
    metaApiMetrics,
    ncMetaAclMw(baseDisableShareErd, 'baseDisableShareErd')
  );
};
