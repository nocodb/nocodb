import { Injectable } from '@nestjs/common';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import { BaseMembersV3Service as BaseMembersV3ServiceCE } from 'src/services/v3/base-members-v3.service';
import type { ProjectUserReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { BaseUser, User } from '~/models';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { WorkspaceUser } from '~/models';
import { validatePayload } from '~/helpers';

@Injectable()
export class BaseMembersV3Service extends BaseMembersV3ServiceCE {
  constructor(
    protected baseUsersService: BaseUsersService,
    protected workspaceUsersService: WorkspaceUsersService,
  ) {
    super(baseUsersService);
  }

  async userInvite(
    context: NcContext,
    param: {
      baseId: string;
      baseMembers: any[];
      req: NcRequest;
    },
  ): Promise<any> {
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseMemberCreate',
      param.baseMembers,
      true,
    );

    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    try {
      for (const baseUser of param.baseMembers) {
        // if workspace user is not provided, then we need to invite the user to workspace with NO_ACCESS role
        // if (!baseUser.workspace_role) {
        // get the user from workspace
        let user: User;
        if (baseUser.user_id) {
          user = await User.get(baseUser.user_id, ncMeta);
          if (!user) {
            NcError.userNotFound(baseUser.user_id);
          }
          baseUser.email = user.email;
        } else if (baseUser.email) {
          user = await User.getByEmail(baseUser.email, ncMeta);
        } else {
          NcError.badRequest('Either email or id is required');
        }

        if (user) {
          const workspaceUser = await WorkspaceUser.get(
            param.req.ncWorkspaceId,
            user.id,
            ncMeta,
          );
          if (!workspaceUser) {
            baseUser.workspace_role = WorkspaceUserRoles.NO_ACCESS;
          }
        } else {
          baseUser.workspace_role = WorkspaceUserRoles.NO_ACCESS;
        }
        // }

        // invite at the workspace level if workspace role is provided
        if (baseUser.workspace_role) {
          await this.workspaceUsersService.invite(
            {
              body: {
                roles: baseUser.workspace_role,
                email: baseUser.email,
              },
              siteUrl: param.req.ncSiteUrl,
              invitedBy: param.req.user,
              req: param.req,
              workspaceId: param.req.ncWorkspaceId,
            },
            ncMeta,
          );
        }

        await this.baseUsersService.userInvite(
          context,
          {
            baseId: param.baseId,
            baseUser: {
              email: baseUser.email,
              roles: baseUser.base_role as ProjectUserReqType['roles'],
            },
            req: param.req,
          },
          ncMeta,
        );

        user = await User.getByEmail(baseUser.email, ncMeta);

        userIds.push(user.id);
      }
      await ncMeta.commit();
    } catch (e) {
      // on error rollback the transaction and throw the error
      await ncMeta.rollback();
      throw e;
    }
    return this.builder().build(
      await BaseUser.getUsersList(context, {
        base_id: param.baseId,
        user_ids: userIds,
      }),
    );
  }
}
