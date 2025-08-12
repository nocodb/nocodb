import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { NcContext } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { WorkspaceV3Service } from '~/ee/services/v3/workspace-v3.service';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class WorkspaceV3Controller {
  constructor(protected readonly workspaceV3Service: WorkspaceV3Service) {}

  @Get(['/api/v3/meta/workspaces/:workspaceId'])
  @Acl('workspaceRead')
  async workspaceRead(
    @TenantContext()
    context: NcContext,
    @Param('workspaceId')
    workspaceId: string,
    @Query('include') include?: string | string[],
  ) {
    // Handle both single string and array of strings for include parameter
    const includeArray = Array.isArray(include)
      ? include
      : include
      ? [include]
      : undefined;

    return await this.workspaceV3Service.workspaceRead(context, {
      workspaceId,
      include: includeArray,
    });
  }
}
