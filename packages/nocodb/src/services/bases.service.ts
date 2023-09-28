import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { BaseReqType } from 'nocodb-sdk';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { populateMeta, validatePayload } from '~/helpers';
import { populateRollupColumnAndHideLTAR } from '~/helpers/populateMeta';
import { syncBaseMigration } from '~/helpers/syncMigration';
import { Base, Project } from '~/models';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class BasesService {
  constructor(protected readonly appHooksService: AppHooksService) {}

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

    this.appHooksService.emit(AppEvents.BASE_UPDATE, {
      base,
    });

    return base;
  }

  async baseList(param: { projectId: string }) {
    const bases = await Base.list({ projectId: param.projectId });

    return bases;
  }

  async baseDelete(param: { baseId: string }) {
    try {
      const base = await Base.get(param.baseId, true);
      await base.delete();
      this.appHooksService.emit(AppEvents.BASE_DELETE, {
        base,
      });
    } catch (e) {
      NcError.badRequest(e);
    }
    return true;
  }

  async baseSoftDelete(param: { baseId: string }) {
    try {
      const base = await Base.get(param.baseId);
      await base.softDelete();
    } catch (e) {
      NcError.badRequest(e);
    }
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

    await populateRollupColumnAndHideLTAR(base, project);

    this.appHooksService.emit(AppEvents.APIS_CREATED, {
      info,
    });

    delete base.config;

    this.appHooksService.emit(AppEvents.BASE_CREATE, {
      base,
    });

    return base;
  }
}
