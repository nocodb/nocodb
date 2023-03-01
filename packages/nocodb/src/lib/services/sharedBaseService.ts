import { Tele } from 'nc-help';
import { v4 as uuidv4 } from 'uuid';
import Project from '../models/Project';
import { NcError } from '../meta/helpers/catchError';
// todo: load from config
const config = {
  dashboardPath: '/nc',
};

export async function createSharedBaseLink(param:{
  projectId: string;
  roles: string;
  password: string;
  siteUrl: string;
}): Promise<any> {
  const project = await Project.get(param.projectId);

  let roles = param?.roles;
  if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
    roles = 'viewer';
  }

  if (!project) {
    NcError.badRequest('Invalid project id');
  }

  const data: any = {
    uuid: uuidv4(),
    password: param?.password,
    roles,
  };

  await Project.update(project.id, data);

  data.url = `${param.siteUrl}${config.dashboardPath}#/nc/base/${data.uuid}`;
  delete data.password;
  Tele.emit('evt', { evt_type: 'sharedBase:generated-link' });
  return data;
}

export async function updateSharedBaseLink(param: {
  projectId: string;
  roles: string;
  password: string;
  siteUrl: string;
}): Promise<any> {
  const project = await Project.get(param.projectId);

  let roles = param.roles;
  if (!roles || (roles !== 'editor' && roles !== 'viewer')) {
    roles = 'viewer';
  }

  if (!project) {
    NcError.badRequest('Invalid project id');
  }
  const data: any = {
    uuid: project.uuid || uuidv4(),
    password: param.password,
    roles,
  };

  await Project.update(project.id, data);

  data.url = `${param.siteUrl}${config.dashboardPath}#/nc/base/${data.uuid}`;
  delete data.password;
  Tele.emit('evt', { evt_type: 'sharedBase:generated-link' });
  return data;
}

export async function disableSharedBaseLink(param:{
  projectId: string;
}): Promise<any> {
  const project = await Project.get(param.projectId);

  if (!project) {
    NcError.badRequest('Invalid project id');
  }
  const data: any = {
    uuid: null,
  };

  await Project.update(project.id, data);

  Tele.emit('evt', { evt_type: 'sharedBase:disable-link' });

  return { uuid: null }
}

export async function getSharedBaseLink(param:{
  projectId: string;
  siteUrl: string;
}): Promise<any> {
  const project = await Project.get(param.projectId);

  if (!project) {
    NcError.badRequest('Invalid project id');
  }
  const data: any = {
    uuid: project.uuid,
    roles: project.roles,
  };
  if (data.uuid)
    data.url = `${param.siteUrl}${config.dashboardPath}#/nc/base/${data.shared_base_id}`;

  return data;
}

