import { Router } from 'express';
import { Tele } from 'nc-help';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { v4 as uuidv4 } from 'uuid';
import Project from '../../models/Project';
import { NcError } from '../helpers/catchError';
// todo: load from config
const config = {
  dashboardPath: '/nc',
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
    roles,
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
    roles,
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
    uuid: null,
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
    roles: project.roles,
  };
  if (data.uuid)
    data.url = `${req.ncSiteUrl}${config.dashboardPath}#/nc/base/${data.shared_base_id}`;

  res.json(data);
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/projects/:projectId/shared',
  ncMetaAclMw(getSharedBaseLink, 'getSharedBaseLink')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/shared',
  ncMetaAclMw(createSharedBaseLink, 'createSharedBaseLink')
);
router.patch(
  '/api/v1/db/meta/projects/:projectId/shared',
  ncMetaAclMw(updateSharedBaseLink, 'updateSharedBaseLink')
);
router.delete(
  '/api/v1/db/meta/projects/:projectId/shared',
  ncMetaAclMw(disableSharedBaseLink, 'disableSharedBaseLink')
);
export default router;
