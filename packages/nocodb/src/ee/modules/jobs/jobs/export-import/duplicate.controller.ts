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
import { DuplicateController as DuplicateControllerCE } from 'src/modules/jobs/jobs/export-import/duplicate.controller';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { BasesService } from '~/services/bases.service';
import { Base } from '~/models';
import { JobTypes } from '~/interface/Jobs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { RootScopes } from '~/utils/globals';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class DuplicateController extends DuplicateControllerCE {
  constructor(
    @Inject('JobsService') protected readonly jobsService,
    protected readonly basesService: BasesService,
  ) {
    super(jobsService, basesService);
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

    const dupProject = await this.basesService.baseCreate({
      base: {
        title: base.title,
        status: ProjectStatus.JOB,
        ...body.base,
        ...(workspaceId ? { fk_workspace_id: workspaceId } : {}),
      },
      user: { id: req.user.id },
      req: {} as any,
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
      },
    });

    return { id: job.id, base_id: dupProject.id, fk_workspace_id: workspaceId };
  }
}
