import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { populateMeta, validatePayload } from '../../helpers';
import { syncBaseMigration } from '../../helpers/syncMigration';
import { Base, Project } from '../../models';
import type { BaseReqType } from 'nocodb-sdk';

@Injectable()
export class BasesService {
  async baseGetWithConfig(param: { baseId: any }) {
    const base = await Base.get(param.baseId);

    base.config = await base.getConnectionConfig();

    return base;
  }

  async baseUpdate(param: {
    baseId: string;
    base: BaseReqType;
    projectId: string;
  }) {
    validatePayload('swagger.json#/components/schemas/BaseReq', param.base);

    const baseBody = param.base;
    const project = await Project.getWithInfo(param.projectId);
    const base = await Base.updateBase(param.baseId, {
      ...baseBody,
      type: baseBody.config?.client,
      projectId: project.id,
      id: param.baseId,
    });

    delete base.config;

    T.emit('evt', {
      evt_type: 'base:updated',
    });

    return base;
  }

  async baseList(param: { projectId: string }) {
    const bases = await Base.list({ projectId: param.projectId });

    return bases;
  }

  async baseDelete(param: { baseId: string }) {
    const base = await Base.get(param.baseId);
    await base.delete();
    T.emit('evt', { evt_type: 'base:deleted' });
    return true;
  }

  async baseCreate(param: { projectId: string; base: BaseReqType }) {
    validatePayload('swagger.json#/components/schemas/BaseReq', param.base);

    // type | base | projectId
    const baseBody = param.base;
    const project = await Project.getWithInfo(param.projectId);
    const base = await Base.createBase({
      ...baseBody,
      type: baseBody.config?.client,
      projectId: project.id,
    });

    await syncBaseMigration(project, base);

    const info = await populateMeta(base, project);

    T.emit('evt_api_created', info);

    delete base.config;

    T.emit('evt', {
      evt_type: 'base:created',
    });

    return base;
  }
}
