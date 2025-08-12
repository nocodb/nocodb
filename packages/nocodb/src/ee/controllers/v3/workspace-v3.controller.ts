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
  /**
   * Validates if the user has access to the member management API.
   * This method checks if the feature is enabled for the workspace.
   * If not, it throws an error indicating that the feature is only available on paid plans.
   */
  async canExecute(context: NcContext) {
    if (
      !(await getFeature(
        PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT,
        context.workspace_id,
      ))
    ) {
      NcError.get(context).invalidRequestBody(
        'Accessing member management api is only available on paid plans. Please upgrade your workspace plan to enable this feature.',
      );
    }
  }

  @Get(['/api/v3/meta/workspaces/:workspaceId'])
  @Acl('workspaceRead', {
    scope: 'workspace',
  })
  async workspaceRead(
    @TenantContext()
    context: NcContext,
    @Param('workspaceId')
    workspaceId: string,
    @Query('include') include?: string | string[],
  ) {
    await this.canExecute(context);

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
