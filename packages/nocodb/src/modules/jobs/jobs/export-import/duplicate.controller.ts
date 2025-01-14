import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppEvents, ProjectStatus, readonlyMetaAllowedTypes } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { BasesService } from '~/services/bases.service';
import { Base, Column, Model, Source } from '~/models';
import { generateUniqueName } from '~/helpers/exportImportHelpers';
import { JobTypes } from '~/interface/Jobs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { MetaTable, RootScopes } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class DuplicateController {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  @Post([
    '/api/v1/db/meta/duplicate/:workspaceId/shared/:sharedBaseId',
    '/api/v2/meta/duplicate/:workspaceId/shared/:sharedBaseId',
  ])
  @HttpCode(200)
  @Acl('duplicateSharedBase', {
    scope: 'org',
  })
  public async duplicateSharedBase(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('workspaceId') _workspaceId: string,
    @Param('sharedBaseId') sharedBaseId: string,
    @Body()
    body?: {
      options?: {
        excludeData?: boolean;
        excludeViews?: boolean;
      };
      base?: any;
    },
  ) {
    const base = await Base.getByUuid(
      {
        workspace_id: RootScopes.BASE,
        base_id: RootScopes.BASE,
      },
      sharedBaseId,
    );

    if (!base) {
      throw new Error(`Base not found for id '${sharedBaseId}'`);
    }

    const source = (await base.getSources())[0];

    if (!source) {
      throw new Error(`Source not found!`);
    }

    const bases = await Base.list(context.workspace_id);

    const uniqueTitle = generateUniqueName(
      `${base.title} copy`,
      bases.map((p) => p.title),
    );

    const dupProject = await this.basesService.baseCreate({
      base: {
        title: uniqueTitle,
        status: ProjectStatus.JOB,
        ...(body.base || {}),
      },
      user: { id: req.user.id },
      req,
    });

    const job = await this.jobsService.add(JobTypes.DuplicateBase, {
      context: {
        workspace_id: base.fk_workspace_id,
        base_id: base.id,
      },
      user: req.user,
      baseId: base.id,
      sourceId: source.id,
      dupProjectId: dupProject.id,
      options: {
        ...body.options,
        excludeHooks: true,
      },
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
      },
    });

    return { id: job.id, base_id: dupProject.id };
  }

  @Post([
    '/api/v1/db/meta/duplicate/:baseId/:sourceId?',
    '/api/v2/meta/duplicate/:baseId/:sourceId?',
  ])
  @HttpCode(200)
  @Acl('duplicateBase')
  async duplicateBase(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId?: string,
    @Body()
    body?: {
      options?: {
        excludeData?: boolean;
        excludeViews?: boolean;
        excludeHooks?: boolean;
      };
      // override duplicated base
      base?: any;
    },
  ) {
    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error(`Base not found for id '${baseId}'`);
    }

    const source = sourceId
      ? await Source.get(context, sourceId)
      : (await base.getSources())[0];

    if (!source) {
      throw new Error(`Source not found!`);
    }

    const bases = await Base.list(context.workspace_id);

    const uniqueTitle = generateUniqueName(
      `${base.title} copy`,
      bases.map((p) => p.title),
    );

    const parentAuditId = await Noco.ncMeta.genNanoid(MetaTable.AUDIT);

    req.ncParentAuditId = parentAuditId;

    const dupProject = await this.basesService.baseCreate({
      base: {
        title: uniqueTitle,
        status: ProjectStatus.JOB,
        ...(body.base || {}),
      },
      user: {
        id: req.user.id,
        email: req.user.email,
        display_name: req.user.display_name,
      },
      req,
    });

    this.appHooksService.emit(AppEvents.BASE_DUPLICATE_START, {
      sourceBase: base,
      destBase: dupProject,
      user: req.user,
      req,
      context,
      id: parentAuditId,
      options: body?.options,
    });

    const job = await this.jobsService.add(JobTypes.DuplicateBase, {
      context,
      user: req.user,
      baseId: base.id,
      sourceId: source.id,
      dupProjectId: dupProject.id,
      options: body.options || {},
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
        ncParentAuditId: parentAuditId,
      },
    });

    return { id: job.id, base_id: dupProject.id };
  }

  @Post([
    '/api/v1/db/meta/duplicate/:baseId/table/:modelId',
    '/api/v2/meta/duplicate/:baseId/table/:modelId',
  ])
  @HttpCode(200)
  @Acl('duplicateModel')
  async duplicateModel(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
    @Param('modelId') modelId?: string,
    @Body()
    body?: {
      title?: string;
      options?: {
        excludeData?: boolean;
        excludeViews?: boolean;
        excludeHooks?: boolean;
      };
    },
  ) {
    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error(`Base not found for id '${baseId}'`);
    }

    const model = await Model.get(context, modelId);

    if (!model) {
      throw new Error(`Model not found!`);
    }

    const parentAuditId = await Noco.ncMeta.genNanoid(MetaTable.AUDIT);
    this.appHooksService.emit(AppEvents.TABLE_DUPLICATE_START, {
      sourceTable: model,
      user: req.user,
      req,
      context,
      id: parentAuditId,
      title: body?.title,
      options: body?.options,
    });
    req.ncParentAuditId = parentAuditId;

    const source = await Source.get(context, model.source_id);

    // if data/schema is readonly, then restrict duplication
    if (source.is_schema_readonly) {
      NcError.sourceMetaReadOnly(source.alias);
    }
    if (source.is_data_readonly) {
      NcError.sourceDataReadOnly(source.alias);
    }

    const models = await source.getModels(context);

    const uniqueTitle = generateUniqueName(
      body.title || `${model.title} copy`,
      models.map((p) => p.title),
    );

    const job = await this.jobsService.add(JobTypes.DuplicateModel, {
      context,
      user: req.user,
      baseId: base.id,
      sourceId: source.id,
      modelId: model.id,
      title: uniqueTitle,
      options: body.options || {},
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
        ncParentAuditId: parentAuditId,
      },
    });

    return { id: job.id };
  }

  @Post([
    '/api/v1/db/meta/duplicate/:baseId/column/:columnId',
    '/api/v2/meta/duplicate/:baseId/column/:columnId',
  ])
  @HttpCode(200)
  @Acl('duplicateColumn')
  async duplicateColumn(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
    @Param('columnId') columnId?: string,
    @Body()
    body?: {
      options?: {
        excludeData?: boolean;
      };
      extra?: any;
    },
  ) {
    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error(`Base not found for id '${baseId}'`);
    }

    const column = await Column.get(context, {
      source_id: base.id,
      colId: columnId,
    });

    if (!column) {
      throw new Error(`Column not found!`);
    }

    const model = await Model.get(context, column.fk_model_id);

    if (!model) {
      throw new Error(`Model not found!`);
    }

    const parentAuditId = await Noco.ncMeta.genNanoid(MetaTable.AUDIT);
    this.appHooksService.emit(AppEvents.COLUMN_DUPLICATE_START, {
      table: model,
      sourceColumn: column,
      user: req.user,
      req,
      context,
      id: parentAuditId,
      options: body?.options,
    });
    req.ncParentAuditId = parentAuditId;

    const source = await Source.get(context, model.source_id);

    // check if source is readonly and column type is not allowed
    if (!readonlyMetaAllowedTypes.includes(column.uidt)) {
      if (source.is_schema_readonly) {
        NcError.sourceMetaReadOnly(source.alias);
      }
      if (source.is_data_readonly) {
        NcError.sourceDataReadOnly(source.alias);
      }
    }

    const job = await this.jobsService.add(JobTypes.DuplicateColumn, {
      context,
      user: req.user,
      baseId: base.id,
      sourceId: column.source_id,
      modelId: model.id,
      columnId: column.id,
      options: body.options || {},
      extra: body.extra || {},
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
        ncParentAuditId: parentAuditId,
        ncSourceId: source.id,
        ncBaseId: baseId,
      },
    });

    return { id: job.id };
  }
}
