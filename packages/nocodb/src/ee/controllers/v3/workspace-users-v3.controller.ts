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
import { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { WorkspaceUsersV3Service } from '~/ee/services/v3/workspace-users-v3.service';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class WorkspaceUsersV3Controller {
  constructor(
    protected readonly workspaceUsersV3Service: WorkspaceUsersV3Service,
  ) {}
  //
  // @Get(['/api/v3/meta/workspaces/:workspaceId/members'])
  // @Acl('workspaceUserList')
  // async userList(
  //   @TenantContext()
  //   context: NcContext,
  //   @Param('workspaceId')
  //   workspaceId: string,
  // ) {
  //   return await this.workspaceUsersV3Service.userList(context, {
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
    this.validatePayload(workspaceUsers);

    return await this.workspaceUsersV3Service.userInvite(context, {
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
    this.validatePayload(workspaceUsers);

    return await this.workspaceUsersV3Service.workspaceUserUpdate(context, {
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
    this.validatePayload(workspaceUsers);

    return await this.workspaceUsersV3Service.workspaceUserDelete(context, {
      workspaceId,
      req,
      workspaceUsers: Array.isArray(workspaceUsers)
        ? workspaceUsers
        : [workspaceUsers],
    });
  }

  private validatePayload(
    workspaceUsers:
      | { user_id?: string; user_email?: string }[]
      | { user_id?: string; user_email?: string },
  ) {
    // check email or id is present
    if (
      !workspaceUsers ||
      (Array.isArray(workspaceUsers) ? workspaceUsers : [workspaceUsers]).some(
        (user) => !user.user_id && !user.user_email,
      )
    ) {
      NcError.badRequest('Either email or id is required');
    }
  }
}
