import { Injectable } from '@nestjs/common';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import { BaseMembersV3Service as BaseMembersV3ServiceCE } from 'src/services/v3/base-members-v3.service';
import type { ProjectRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { BaseUser, User } from '~/models';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { WorkspaceUser } from '~/models';
import { validatePayload } from '~/helpers';
import { V3_META_REQUEST_LIMIT } from '~/constants';

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

    if (param.baseMembers?.length > V3_META_REQUEST_LIMIT) {
      NcError.get(context).maxInsertLimitExceeded(V3_META_REQUEST_LIMIT);
    }
    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    const rollbacks = [];
    const postOperations = [];
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
          const { execute, rollback: eachRollback } =
            await this.workspaceUsersService.prepareUserInviteByEmail(
              {
                roles: baseUser.workspace_role,
                email: baseUser.email,
                displayName: baseUser.user_name,
                siteUrl: param.req.ncSiteUrl,
                req: param.req,
                workspaceId: param.req.ncWorkspaceId,
              },
              ncMeta,
            );
          rollbacks.push(eachRollback);
          const { postOperations: eachPostOperations } = await execute();
          postOperations.push(...eachPostOperations);
        }

        const { execute, rollback: eachRollback } =
          await this.baseUsersService.prepareUserInviteByEmail(
            context,
            {
              email: baseUser.email,
              roles: baseUser.base_role as ProjectRoles,
              baseId: param.baseId,
              displayName: baseUser.user_name,
              req: param.req,
            },
            ncMeta,
          );
        // we collect the rollback actions need to be performed during rollback
        // TODO: attach to meta transaction when it's ready
        rollbacks.push(eachRollback);
        const { postOperations: eachPostOperations } = await execute();
        postOperations.push(...eachPostOperations);

        user = await User.getByEmail(baseUser.email, ncMeta);

        userIds.push(user.id);
      }
      await ncMeta.commit();
    } catch (e) {
      // on error rollback the transaction and throw the error
      await ncMeta.rollback();
      for (const eachRollback of rollbacks) {
        await eachRollback();
      }
      throw e;
    }
    for (const eachPostOperation of postOperations) {
      await eachPostOperation();
    }

    return this.builder().build(
      await BaseUser.getUsersList(context, {
        base_id: param.baseId,
        user_ids: userIds,
      }),
    );
  }
}
