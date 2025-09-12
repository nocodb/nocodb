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
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';
import { generateUniqueName } from '~/helpers/exportImportHelpers';
import { NcContext, NcRequest } from '~/interface/config';
import { JobTypes } from '~/interface/Jobs';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { Base, Column, Model, Source } from '~/models';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { DuplicateService } from '~/modules/jobs/jobs/export-import/duplicate.service';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import { DuplicateModelUtils } from '~/utils/duplicate-model.utils';
import { MetaTable, RootScopes } from '~/utils/globals';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class DuplicateController {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
    protected readonly appHooksService: AppHooksService,
    protected readonly duplicateService: DuplicateService,
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
      req,
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
        excludeScripts?: boolean;
        excludeDashboards?: boolean;
      };
      // override duplicated base
      base?: any;
    },
  ) {
    return await this.duplicateService.duplicateBase({
      context,
      req,
      baseId,
      sourceId,
      body,
    });
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
        targetWorkspaceId?: string;
        targetBaseId?: string;
      };
    },
  ) {
    const { sourceBase, sourceModel, sourceSource, targetSource, uniqueTitle } =
      await DuplicateModelUtils._.getDuplicateModelTaskInfo({
        baseId,
        body,
        context,
        modelId,
      });

    const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);
    this.appHooksService.emit(AppEvents.TABLE_DUPLICATE_START, {
      sourceTable: sourceModel,
      user: req.user,
      req,
      context,
      id: parentAuditId,
      title: body?.title,
      options: body?.options,
    });

    req.ncParentAuditId = parentAuditId;

    const job = await this.jobsService.add(JobTypes.DuplicateModel, {
      context,
      user: req.user,
      baseId: sourceBase.id,
      sourceId: sourceSource.id,
      targetSourceId: targetSource.id,
      modelId: sourceModel.id,
      title: uniqueTitle,
      options: body.options || {},
      req,
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

    const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);
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

    req.ncParentAuditId = parentAuditId;
    req.ncBaseId = baseId;
    req.ncSourceId = source.id;

    const job = await this.jobsService.add(JobTypes.DuplicateColumn, {
      context,
      user: req.user,
      baseId: base.id,
      sourceId: column.source_id,
      modelId: model.id,
      columnId: column.id,
      options: body.options || {},
      extra: body.extra || {},
      req,
    });

    return { id: job.id };
  }
}
