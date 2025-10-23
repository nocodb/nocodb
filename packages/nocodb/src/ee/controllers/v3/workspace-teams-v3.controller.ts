import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import type {
  WorkspaceTeamDetailV3Type,
  WorkspaceTeamListV3Type,
  WorkspaceTeamV3ResponseType,
} from '~/ee/services/v3/workspace-teams-v3.types';
import {
  WorkspaceTeamCreateV3ReqType,
  WorkspaceTeamCreateV3BulkReqType,
  WorkspaceTeamDeleteV3ReqType,
  WorkspaceTeamDeleteV3BulkReqType,
  WorkspaceTeamUpdateV3ReqType,
} from '~/ee/services/v3/workspace-teams-v3.types';
import { NcRequest } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { WorkspaceTeamsV3Service } from '~/ee/services/v3/workspace-teams-v3.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';
import { getFeature } from '~/helpers/paymentHelpers';
import { NcError } from '~/helpers/catchError';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class WorkspaceTeamsV3Controller {
  constructor(
    private readonly workspaceTeamsV3Service: WorkspaceTeamsV3Service,
  ) {}

  /**
   * Validates if the user has access to the Teams API.
   * This method checks if the feature is enabled for the workspace.
   * If not, it throws an error indicating that the feature is only available on paid plans.
   */
  async canExecute(context: NcContext) {
    if (
      !(await getFeature(
        PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
        context.workspace_id,
      ))
    ) {
      NcError.forbidden(
        'Accessing Teams API is only available on paid plans. Please upgrade your workspace plan to enable this feature. Your current plan is not sufficient.',
      );
    }
  }

  @Get('/api/v3/meta/workspaces/:workspaceId/invites')
  @Acl('teamList', {
    scope: 'workspace',
  })
  async teamList(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
  ): Promise<WorkspaceTeamListV3Type> {
    await this.canExecute(context);
    return this.workspaceTeamsV3Service.teamList(context, {
      workspaceId,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceId/invites')
  @HttpCode(200)
  @Acl('teamCreate', {
    scope: 'workspace',
  })
  async teamAdd(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body() team: WorkspaceTeamCreateV3ReqType,
    @Req() req: NcRequest,
  ): Promise<WorkspaceTeamV3ResponseType> {
    await this.canExecute(context);
    return this.workspaceTeamsV3Service.teamAdd(context, {
      workspaceId,
      team,
      req,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceId/invites/bulk')
  @HttpCode(200)
  @Acl('teamCreate', {
    scope: 'workspace',
  })
  async teamAddBulk(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body() teams: WorkspaceTeamCreateV3BulkReqType,
    @Req() req: NcRequest,
  ): Promise<WorkspaceTeamV3ResponseType[]> {
    await this.canExecute(context);
    return this.workspaceTeamsV3Service.teamAddBulk(context, {
      workspaceId,
      teams,
      req,
    });
  }

  @Get('/api/v3/meta/workspaces/:workspaceId/invites/:teamId')
  @Acl('teamGet', {
    scope: 'workspace',
  })
  async teamDetail(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('teamId') teamId: string,
  ): Promise<WorkspaceTeamDetailV3Type> {
    await this.canExecute(context);
    return this.workspaceTeamsV3Service.teamDetail(context, {
      workspaceId,
      teamId,
    });
  }

  @Patch('/api/v3/meta/workspaces/:workspaceId/invites')
  @Acl('teamUpdate', {
    scope: 'workspace',
  })
  async teamUpdate(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body() team: WorkspaceTeamUpdateV3ReqType | WorkspaceTeamUpdateV3ReqType[],
    @Req() req: NcRequest,
  ): Promise<WorkspaceTeamV3ResponseType | WorkspaceTeamV3ResponseType[]> {
    await this.canExecute(context);
    return this.workspaceTeamsV3Service.teamUpdate(context, {
      workspaceId,
      team,
      req,
    });
  }

  @Delete('/api/v3/meta/workspaces/:workspaceId/invites')
  @Acl('teamDelete', {
    scope: 'workspace',
  })
  async teamRemove(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body() team: WorkspaceTeamDeleteV3ReqType | WorkspaceTeamDeleteV3ReqType[],
    @Req() req: NcRequest,
  ): Promise<{ msg: string }> {
    await this.canExecute(context);
    return this.workspaceTeamsV3Service.teamRemove(context, {
      workspaceId,
      team,
      req,
    });
  }

  @Delete('/api/v3/meta/workspaces/:workspaceId/invites/bulk')
  @Acl('teamDelete', {
    scope: 'workspace',
  })
  async teamRemoveBulk(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body() teams: WorkspaceTeamDeleteV3BulkReqType,
    @Req() req: NcRequest,
  ): Promise<{ msg: string }> {
    await this.canExecute(context);
    return this.workspaceTeamsV3Service.teamRemoveBulk(context, {
      workspaceId,
      teams,
      req,
    });
  }
}
