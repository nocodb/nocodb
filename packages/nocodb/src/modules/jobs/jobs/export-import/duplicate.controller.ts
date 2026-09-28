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
import { ProjectStatus } from 'nocodb-sdk';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';
import { generateUniqueName } from '~/helpers/exportImportHelpers';
import { NcContext, NcRequest } from '~/interface/config';
import { JobTypes } from '~/interface/Jobs';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { Base } from '~/models';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { DuplicateService } from '~/modules/jobs/jobs/export-import/duplicate.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import { RootScopes } from '~/utils/globals';

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
      NcError.get(context).baseNotFound(sharedBaseId);
    }

    const source = (await base.getSources())[0];

    if (!source) {
      NcError.get(context).noSourcesFound();
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
        fk_workspace_id: context.workspace_id,
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
      dupWorkspaceId: dupProject.fk_workspace_id,
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
        excludeInterfaces?: boolean;
        excludeWorkflows?: boolean;
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
    return await this.duplicateService.duplicateModel({
      context,
      req,
      baseId,
      modelId,
      body,
    });
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
    return await this.duplicateService.duplicateColumn({
      context,
      req,
      baseId,
      columnId,
      body,
    });
  }
}
