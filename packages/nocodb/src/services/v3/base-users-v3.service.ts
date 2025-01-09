import { Injectable, Logger } from '@nestjs/common';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import type { ProjectUserReqType, ProjectUserV3ReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { BaseUser, User } from '~/models';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { WorkspaceUsersService } from '~/ee/services/workspace-users.service';
import { WorkspaceUser } from '~/ee/models';

@Injectable()
export class BaseUsersV3Service {
  private readonly logger = new Logger(BaseUsersV3Service.name);
  private builder: () => ApiV3DataTransformationBuilder<
    BaseUser,
    Partial<BaseUser>
  >;

  constructor(
    protected baseUsersService: BaseUsersService,
    protected workspaceUsersService: WorkspaceUsersService,
  ) {
    this.builder = builderGenerator({
      allowed: [
        'id',
        'email',
        'name',
        'created_at',
        'updated_at',
        'roles',
        'workspace_roles',
        'workspace_id',
      ],
      mappings: {
        roles: 'base_role',
        workspace_roles: 'workspace_role',
        display_name: 'name',
      },
    });
  }

  async userList(
    context: NcContext,
    param: { baseId: string; mode?: 'full' | 'viewer' },
  ) {
    const baseUsers = await BaseUser.getUsersList(context, {
      base_id: param.baseId,
      mode: param.mode,
    });

    return { list: this.builder().build(baseUsers) };
  }

  async userInvite(
    context: NcContext,
    param: {
      baseId: string;
      baseUsers: ProjectUserV3ReqType[];
      req: NcRequest;
    },
  ): Promise<any> {
    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    try {
      for (const baseUser of param.baseUsers) {
        // todo: enable later
        // validatePayload(
        //   'swagger.json#/components/schemas/ProjectUserV3Req',
        //   baseUser,
        // );

        // if workspace user is not provided, then we need to invite the user to workspace with NO_ACCESS role
        // if (!baseUser.workspace_role) {
        // get the user from workspace
        let user = await User.getByEmail(baseUser.email, ncMeta);
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

        user = await User.getByEmail(baseUser.email);

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

  async baseUserUpdate(
    context: NcContext,
    param: {
      userId: string;
      baseUsers: ProjectUserV3ReqType[];
      req: any;
      baseId: string;
    },
  ): Promise<any> {
    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    try {
      for (const baseUser of param.baseUsers) {
        validatePayload(
          'swagger.json#/components/schemas/ProjectUserV3Req',
          baseUser,
        );

        let userId = baseUser.id;

        if (!baseUser.id && baseUser.email) {
          const user = await User.getByEmail(baseUser.email, ncMeta);
          if (user) {
            userId = user.id;
          } else {
            NcError.userNotFound(baseUser.email);
          }
        }

        userIds.push(userId);

        // if (baseUser.workspace_role) {
        //   await this.workspaceUsersService.update(
        //     {
        //       userId,
        //       req: param.req,
        //       workspaceId: param.req.ncWorkspaceId,
        //       roles: baseUser.workspace_role as WorkspaceUserRoles,
        //       siteUrl: param.req.ncSiteUrl,
        //     },
        //     ncMeta,
        //   );
        // }

        await this.baseUsersService.baseUserUpdate(context, {
          baseId: param.baseId,
          baseUser: {
            roles: baseUser.base_role as ProjectUserReqType['roles'],
          },
          userId,
          req: param.req,
        });
      }
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

  /*  async baseUserDelete(
    context: NcContext,
    param: {
      baseUsers: ProjectUserDeleteV3ReqType[];
      baseId: string;
      req: any;
    },
  ): Promise<any> {
    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    try {
    for (const baseUser of param.baseUsers) {
      // validatePayload(
      //   'swagger.json#/components/schemas/ProjectUserDeleteV3Req',
      //   baseUser,
      // );

      let userId = baseUser.id;

      // if email is provided, then we need to find the user id
      if (!baseUser.id && baseUser.email) {
        const user = await User.getByEmail(baseUser.email);
        if (user) {
          userId = user.id;
        } else {
          NcError.userNotFound(baseUser.email);
        }
      }

      await this.baseUsersService.baseUserDelete(context, {
        baseId: param.baseId,
        userId,
        req: param.req,
      });
    }
  }*/
}
