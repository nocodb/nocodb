import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { AppEvents } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError';
import { Project } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';

// todo: load from config
const config = {
  dashboardPath: '/nc',
};

@Injectable()
export class SharedBasesService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async createSharedBaseLink(param: {
    projectId: string;
    roles: string;
    password: string;
    siteUrl: string;
  }): Promise<any> {
    validatePayload('swagger.json#/components/schemas/SharedBaseReq', param);

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

    this.appHooksService.emit(AppEvents.SHARED_BASE_GENERATE_LINK, {
      link: data.url,
      project,
    });

    return data;
  }

  async updateSharedBaseLink(param: {
    projectId: string;
    roles: string;
    password: string;
    siteUrl: string;
  }): Promise<any> {
    validatePayload('swagger.json#/components/schemas/SharedBaseReq', param);

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
    this.appHooksService.emit(AppEvents.SHARED_BASE_GENERATE_LINK, {
      link: data.url,
      project,
    });
    return data;
  }

  async disableSharedBaseLink(param: { projectId: string }): Promise<any> {
    const project = await Project.get(param.projectId);

    if (!project) {
      NcError.badRequest('Invalid project id');
    }
    const data: any = {
      uuid: null,
    };

    await Project.update(project.id, data);

    this.appHooksService.emit(AppEvents.SHARED_BASE_DELETE_LINK, {
      project,
    });
    return { uuid: null };
  }

  async getSharedBaseLink(param: {
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
}
