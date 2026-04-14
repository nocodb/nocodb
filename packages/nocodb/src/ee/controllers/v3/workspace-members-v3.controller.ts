import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcError } from '~/helpers/catchError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { NcContext, NcRequest } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { WorkspaceMembersV3Service } from '~/services/v3/workspace-members-v3.service';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class WorkspaceMembersV3Controller {
  constructor(
    protected readonly workspaceMemberssV3Service: WorkspaceMembersV3Service,
  ) {}

  async canExecute(context: NcContext) {
    await checkForFeature(
      context,
      PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT,
    );
  }

  //
  // @Get(['/api/v3/meta/workspaces/:workspaceId/members'])
  // @Acl('workspaceUserList')
  // async userList(
  //   @TenantContext()
  //   context: NcContext,
  //   @Param('workspaceId')
  //   workspaceId: string,
  // ) {
  //   return await this.workspaceMemberssV3Service.userList(context, {
  //     workspaceId,
  //   });
  // }

  @Post(['/api/v3/meta/workspaces/:workspaceId/members'])
  @HttpCode(200)
  @Acl('workspaceUserInvite', {
    scope: 'workspace',
  })
  async userInvite(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Req() req: NcRequest,
    @Body() workspaceUsers: any | any[],
  ): Promise<any> {
    await this.canExecute(context);

    this.validatePayload(workspaceUsers, false);

    return await this.workspaceMemberssV3Service.userInvite(context, {
      workspaceId,
      workspaceUsers: Array.isArray(workspaceUsers)
        ? workspaceUsers
        : [workspaceUsers],
      req,
    });
  }

  @Patch(['/api/v3/meta/workspaces/:workspaceId/members'])
  @Acl('workspaceUserUpdate', {
    scope: 'workspace',
  })
  async workspaceUserUpdate(
    @TenantContext()
    context: NcContext,
    @Param('workspaceId')
    workspaceId: string,
    @Req()
    req: NcRequest,
    @Body() workspaceUsers: any | any[],
  ): Promise<any> {
    await this.canExecute(context);

    this.validatePayload(workspaceUsers);

    return await this.workspaceMemberssV3Service.workspaceUserUpdate(context, {
      workspaceUsers: Array.isArray(workspaceUsers)
        ? workspaceUsers
        : [workspaceUsers],
      workspaceId,
      req,
    });
  }

  @Delete(['/api/v3/meta/workspaces/:workspaceId/members'])
  @Acl('workspaceUserDelete', {
    scope: 'workspace',
  })
  async workspaceUserDelete(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Req() req: NcRequest,
    @Body() workspaceUsers: any | any[],
  ): Promise<any> {
    await this.canExecute(context);

    this.validatePayload(workspaceUsers);

    await this.workspaceMemberssV3Service.workspaceUserDelete(context, {
      workspaceId,
      req,
      workspaceUsers: Array.isArray(workspaceUsers)
        ? workspaceUsers
        : [workspaceUsers],
    });
  }

  private validatePayload(
    workspaceUsers:
      | { user_id?: string; email?: string }[]
      | { user_id?: string; email?: string },
    idOnly = true,
  ) {
    // check email or id is present
    if (
      !workspaceUsers ||
      (Array.isArray(workspaceUsers) ? workspaceUsers : [workspaceUsers]).some(
        (user) => {
          if (idOnly) return !user.user_id;
          return (!user.user_id && !user.email) || (user.user_id && user.email);
        },
      )
    ) {
      if (idOnly) NcError.badRequest('user_id is required');
      else NcError.badRequest('Either email or user_id is required');
    }
  }
}
