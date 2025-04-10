import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  NON_SEAT_ROLES,
  type ProjectRoles,
  ProjectUserReqType,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { BaseUsersController as BaseUsersControllerCE } from 'src/controllers/base-users.controller';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { User, WorkspaceUser } from '~/models';
import { NcError } from '~/helpers/catchError';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
export class BaseUsersController extends BaseUsersControllerCE {
  constructor(
    protected readonly baseUsersService: BaseUsersService,
    protected readonly workspaceUsersService: WorkspaceUsersService,
  ) {
    super(baseUsersService);
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/users',
    '/api/v2/meta/bases/:baseId/users',
  ])
  @HttpCode(200)
  @Acl('userInvite')
  async userInvite(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    // todo: move this to a service
    if (!body.email) {
      NcError.badRequest('Email is required');
    }

    const user = await User.getByEmail(body.email);

    let workspaceUser;

    if (user) {
      workspaceUser = await WorkspaceUser.get(req.ncWorkspaceId, user.id);
    }

    let wsUserInvited = false;
    if (!workspaceUser) {
      await this.workspaceUsersService.invite({
        workspaceId: req.ncWorkspaceId,
        invitedBy: req.user,
        siteUrl: req.ncSiteUrl,
        req,
        skipEmailInvite: true,
        body: {
          email: body.email,
          roles: WorkspaceUserRoles.NO_ACCESS,
        },
        baseEditor: !NON_SEAT_ROLES.includes(body.roles as ProjectRoles),
      });
      wsUserInvited = true;
    }

    return await this.baseUsersService.userInvite(context, {
      baseId,
      baseUser: body,
      req,
      workspaceInvited: wsUserInvited,
    });
  }
}
