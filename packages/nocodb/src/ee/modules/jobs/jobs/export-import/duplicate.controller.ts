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
import { AppEvents, ProjectStatus } from 'nocodb-sdk';
import { DuplicateController as DuplicateControllerCE } from 'src/modules/jobs/jobs/export-import/duplicate.controller';
import { Request } from 'express';
import { NcError } from '~/helpers/ncError';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { BasesService } from '~/services/bases.service';
import { Base, Dashboard } from '~/models';
import { JobTypes } from '~/interface/Jobs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcContext, NcRequest } from '~/interface/config';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { RemoteImportService } from '~/modules/jobs/jobs/export-import/remote-import.service';
import { DuplicateService } from '~/modules/jobs/jobs/export-import/duplicate.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class DuplicateController extends DuplicateControllerCE {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
    protected readonly appHooksService: AppHooksService,
    protected readonly remoteImportService: RemoteImportService,
    protected readonly duplicateService: DuplicateService,
  ) {
    super(jobsService, basesService, appHooksService, duplicateService);
  }

  @Post([
    '/api/v1/db/meta/duplicate/:workspaceId/shared/:sharedBaseId',
    '/api/v2/meta/duplicate/:workspaceId/shared/:sharedBaseId',
  ])
  @HttpCode(200)
  @Acl('duplicateSharedBase', {
    scope: 'workspace',
  })
  public async duplicateSharedBase(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('sharedBaseId') sharedBaseId: string,
    @Body()
    body?: {
      options?: {
        excludeData?: boolean;
        excludeViews?: boolean;
      };
      // override duplicated base
      base?: any;
    },
  ) {
    const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

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

    const dupProject = await this.basesService.baseCreate({
      base: {
        title: base.title,
        status: ProjectStatus.JOB,
        ...body.base,
        ...(workspaceId ? { fk_workspace_id: workspaceId } : {}),
      },
      user: { id: req.user.id },
      req: { user: { id: req.user.id } } as any,
    });

    const job = await this.jobsService.add(JobTypes.DuplicateBase, {
      context: {
        workspace_id: base.fk_workspace_id,
        base_id: base.id,
      },
      user: req.user,
      baseId: base.id,
      sourceId: source.id,
      dupWorkspaceId: dupProject.fk_workspace_id,
      dupProjectId: dupProject.id,
      options: {
        ...body.options,
        excludeHooks: true,
        excludeScripts: true,
      },
      req: {
        user: req.user,
        clientIp: req.clientIp,
        ncParentAuditId: parentAuditId,
      },
    });

    return { id: job.id, base_id: dupProject.id, fk_workspace_id: workspaceId };
  }

  @Post(['/api/v2/meta/duplicate/remote/:secret'])
  @HttpCode(200)
  public async duplicateRemote(
    @Req() req: Request,
    @Param('secret') secret: string,
  ) {
    if (!secret) {
      NcError.get(req.context).badRequest('Secret missing');
    }

    return await this.remoteImportService.remoteImportProcess(secret, req);
  }

  @Post(['/api/v2/meta/duplicate/:baseId/dashboard/:dashboardId'])
  @HttpCode(200)
  @Acl('duplicateDashboard')
  async duplicateDashboard(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
    @Param('dashboardId') dashboardId?: string,
    @Body()
    body?: {
      extra?: any;
    },
  ) {
    const base = await Base.get(context, baseId);

    if (!base) {
      NcError.get(context).baseNotFound(baseId);
    }

    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.get(context).dashboardNotFound(dashboardId);
    }

    const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);
    this.appHooksService.emit(AppEvents.DASHBOARD_DUPLICATE_START, {
      sourceDashboard: dashboard,
      user: req.user,
      req,
      context,
      id: parentAuditId,
    });

    req.ncParentAuditId = parentAuditId;

    const job = await this.jobsService.add(JobTypes.DuplicateDashboard, {
      context,
      user: req.user,
      baseId: base.id,
      dashboardId: dashboard.id,
      extra: body.extra || {},
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
        ncParentAuditId: parentAuditId,
        ncBaseId: baseId,
      },
    });

    return { id: job.id };
  }
}
