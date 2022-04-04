import { Router } from 'express';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { v4 as uuidv4 } from 'uuid';
import { Tele } from 'nc-help';
import Project from '../../../noco-models/Project';
import catchError, { NcError } from '../helpers/catchError';
// todo: load from config
const config = {
  dashboardPath: '/nc'
};

async function createSharedBaseLink(req, res): Promise<any> {
  const project = await Project.get(req.params.projectId);

  let roles = req.body?.roles;
  if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
    roles = 'viewer';
  }

  if (!project) {
    NcError.badRequest('Invalid project id');
  }
  const data: any = {
    uuid: uuidv4(),
    password: req.body?.password,
    roles
  };

  await Project.update(project.id, data);

  data.url = `${req.ncSiteUrl}${config.dashboardPath}#/nc/base/${data.uuid}`;
  delete data.password;
  Tele.emit('evt', { evt_type: 'sharedBase:generated-link' });
  res.json(data);
}
async function updateSharedBaseLink(req, res): Promise<any> {
  const project = await Project.get(req.params.projectId);

  let roles = req.body?.roles;
  if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
    roles = 'viewer';
  }

  if (!project) {
    NcError.badRequest('Invalid project id');
  }
  const data: any = {
    uuid: project.uuid || uuidv4(),
    password: req.body?.password,
    roles
  };

  await Project.update(project.id, data);

  data.url = `${req.ncSiteUrl}${config.dashboardPath}#/nc/base/${data.uuid}`;
  delete data.password;
  Tele.emit('evt', { evt_type: 'sharedBase:generated-link' });
  res.json(data);
}

async function disableSharedBaseLink(req, res): Promise<any> {
  const project = await Project.get(req.params.projectId);

  if (!project) {
    NcError.badRequest('Invalid project id');
  }
  const data: any = {
    uuid: null
  };

  await Project.update(project.id, data);
  Tele.emit('evt', { evt_type: 'sharedBase:disable-link' });
  res.json({ uuid: null });
}

async function getSharedBaseLink(req, res): Promise<any> {
  const project = await Project.get(req.params.projectId);

  if (!project) {
    NcError.badRequest('Invalid project id');
  }
  const data: any = {
    uuid: project.uuid,
    roles: project.roles
  };
  if (data.uuid)
    data.url = `${req.ncSiteUrl}${config.dashboardPath}#/nc/base/${data.shared_base_id}`;

  res.json(data);
}
async function publicSharedBaseGet(req, res): Promise<any> {
  const project = await Project.getByUuid(req.params.uuid);

  if (!project) {
    NcError.notFound();
  }

  res.json({ project_id: project.id });
}

const router = Router({ mergeParams: true });
router.get('/projects/:projectId/sharedBase', ncMetaAclMw(getSharedBaseLink));
router.post(
  '/projects/:projectId/sharedBase',
  ncMetaAclMw(createSharedBaseLink)
);
router.put(
  '/projects/:projectId/sharedBase',
  ncMetaAclMw(updateSharedBaseLink)
);
router.delete(
  '/projects/:projectId/sharedBase',
  ncMetaAclMw(disableSharedBaseLink)
);
router.get('/public/sharedBase/:uuid', catchError(publicSharedBaseGet));
export default router;
