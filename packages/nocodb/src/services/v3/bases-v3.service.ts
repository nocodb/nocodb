import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';
import { customAlphabet } from 'nanoid';
import {
  AppEvents,
  extractRolesObj,
  IntegrationsType,
  OrgUserRoles,
  SqlUiFactory,
} from 'nocodb-sdk';
import type {
  ProjectReqType,
  ProjectUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { Request } from 'express';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { populateMeta, validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { extractPropsAndSanitize } from '~/helpers/extractProps';
import syncMigration from '~/helpers/syncMigration';
import { Base, BaseUser, Integration } from '~/models';
import Noco from '~/Noco';
import { getToolDir } from '~/utils/nc-config';
import { MetaService } from '~/meta/meta.service';
import { MetaTable, RootScopes } from '~/utils/globals';
import { TablesService } from '~/services/tables.service';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';

@Injectable()
export class BasesV3Service {
  private builder;
  private sourceBuilder;

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected metaService: MetaService,
    protected tablesService: TablesService,
  ) {
    this.builder = builderGenerator({
      allowed: [
        'id',
        'title',
        'description',
        'created_at',
        'updated_at',
        'meta',
        'sources',
      ],
      mappings: {
        name: 'title',
        isMeta: 'is_meta',
        source: 'sources',
      },
    });
    this.sourceBuilder = builderGenerator({
      allowed: [
        'id',
        'title',
        'type',
        'is_schema_readonly',
        'is_data_readonly',
        'integration_id',
      ],
      mappings: {
        name: 'title',
        isMeta: 'is_meta',
        source: 'sources',
      },
    });
  }

  async baseList(
    context: NcContext,
    param: {
      user: { id: string; roles?: string | Record<string, boolean> };
      query?: any;
    },
  ) {
    const bases = extractRolesObj(param.user?.roles)[OrgUserRoles.SUPER_ADMIN]
      ? await Base.list()
      : await BaseUser.getProjectsList(param.user.id, param.query);

    const result = this.builder().build(bases);

    return {
      ...result,
      sources: result.sources && this.sourceBuilder().build(result.sources),
    };
  }

  async getProject(context: NcContext, param: { baseId: string }) {
    const base = await Base.get(context, param.baseId);
    return base;
  }

  async getProjectWithInfo(
    context: NcContext,
    param: { baseId: string; includeConfig?: boolean },
  ) {
    const { includeConfig = true } = param;
    const base = await Base.getWithInfo(context, param.baseId, includeConfig);
    return base;
  }

  sanitizeProject(base: any) {
    const sanitizedProject = { ...base };
    sanitizedProject.sources?.forEach((b: any) => {
      ['config'].forEach((k) => delete b[k]);
    });
    return sanitizedProject;
  }

  async baseUpdate(
    context: NcContext,
    param: {
      baseId: string;
      base: ProjectUpdateReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ProjectUpdateReq',
      param.base,
    );

    const base = await Base.getWithInfo(context, param.baseId);

    const data: Partial<Base> = extractPropsAndSanitize(param?.base as Base, [
      'title',
      'meta',
      'color',
      'status',
      'order',
    ]);
    await this.validateProjectTitle(context, data, base);

    if (data?.order !== undefined) {
      data.order = !isNaN(+data.order) ? +data.order : 0;
    }

    const result = await Base.update(context, param.baseId, data);

    this.appHooksService.emit(AppEvents.PROJECT_UPDATE, {
      base,
      user: param.user,
      req: param.req,
    });

    return result;
  }

  protected async validateProjectTitle(
    context: NcContext,
    data: Partial<Base>,
    base: Base,
  ) {
    if (
      data?.title &&
      base.title !== data.title &&
      (await Base.getByTitle(
        {
          workspace_id: RootScopes.BASE,
          base_id: RootScopes.BASE,
        },
        data.title,
      ))
    ) {
      NcError.badRequest('Base title already in use');
    }
  }

  async baseSoftDelete(
    context: NcContext,
    param: { baseId: any; user: UserType; req: NcRequest },
  ) {
    const base = await Base.getWithInfo(context, param.baseId);

    if (!base) {
      NcError.baseNotFound(param.baseId);
    }

    await Base.softDelete(context, param.baseId);

    this.appHooksService.emit(AppEvents.PROJECT_DELETE, {
      base,
      user: param.user,
      req: param.req,
    });

    return true;
  }

  async baseCreate(_param: { base: ProjectReqType; user: any; req: any }) {
    return null;
  }
}
