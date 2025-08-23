import { Injectable, Logger } from '@nestjs/common';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { User } from '~/models';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { WorkspaceUsersService } from '~/ee/services/workspace-users.service';
import { validatePayload } from '~/helpers';
import WorkspaceUser from '~/ee/models/WorkspaceUser';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';

@Injectable()
export class WorkspaceMembersV3Service {
  protected readonly logger = new Logger(WorkspaceMembersV3Service.name);
  protected builder: () => ApiV3DataTransformationBuilder<
    WorkspaceUser,
    Partial<WorkspaceUser>
  >;

  constructor(protected workspaceUsersService: WorkspaceUsersService) {
    this.builder = builderGenerator({
      allowed: ['email', 'fk_user_id', 'created_at', 'updated_at', 'roles'],
      mappings: {
        email: 'email',
        fk_user_id: 'user_id',
        roles: 'workspace_role',
      },
      transformFn(data) {
        return data;
      },
    });
  }

  async userList(
    context: NcContext,
    param: { workspaceId: string; mode?: 'full' | 'viewer' },
  ) {
    const workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
      include_deleted: false,
    });

    return { list: this.builder().build(workspaceUsers) };
  }

  async userInvite(
    context: NcContext,
    param: {
      workspaceId: string;
      workspaceUsers: {
        user_id?: string;
        email?: string;
        workspace_role: string;
      }[];
      req: NcRequest;
    },
  ): Promise<any> {
    validatePayload(
      'swagger-v3.json#/components/schemas/WorkspaceUserCreate',
      param.workspaceUsers,
      true,
    );

    const workspaceUsers = [];

    // iterate, validate and extract email or user_id from workspaceUsers
    for (const _workspaceUser of param.workspaceUsers) {
      const workspaceUser = {
        ..._workspaceUser,
      };

      let user: User;

      if (workspaceUser.user_id) {
        user = await User.get(workspaceUser.user_id);
        if (!user) {
          NcError.userNotFound(workspaceUser.user_id);
        }
        workspaceUser.email = user.email;
      } else if (workspaceUser.email) {
        user = await User.getByEmail(workspaceUser.email);
        workspaceUser.user_id = user?.id;
      } else {
        NcError.badRequest('Either email or user_id is required');
      }

      if (user) {
        // check if the user is already a member of the workspace
        const existingWorkspaceUser = await WorkspaceUser.get(
          param.workspaceId,
          user?.id,
        );
        // if already exists and has a role then return error
        if (existingWorkspaceUser?.roles) {
          throw new Error(
            `${user.email} with role ${existingWorkspaceUser.roles} already exists in this workspace`,
          );
        }
      }

      workspaceUsers.push(workspaceUser);
    }

    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    const postOperations = [];
    const rollbacks = [];
    try {
      for (const workspaceUser of workspaceUsers) {
        // Set default role if not provided
        if (!workspaceUser.workspace_role) {
          workspaceUser.workspace_role = WorkspaceUserRoles.NO_ACCESS;
        }

        const { execute, rollback } =
          await this.workspaceUsersService.prepareUserInviteByEmail(
            {
              workspaceId: param.workspaceId,
              email: workspaceUser.email,
              roles: workspaceUser.workspace_role,
              siteUrl: param.req.ncSiteUrl,
              req: param.req,
            },
            ncMeta,
          );
        rollbacks.push(rollback);
        const { postOperations: eachPostOperations } = await execute();
        postOperations.push(...eachPostOperations);

        const userId =
          workspaceUser.user_id ??
          (await User.getByEmail(workspaceUser.email, ncMeta)).id;
        userIds.push(userId);
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
    // Get all users and filter by the ones we just invited
    const allUsers = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
      include_deleted: false,
    });

    const invitedUsers = allUsers.filter((user) =>
      userIds.includes(user.fk_user_id),
    );

    return this.builder().build(invitedUsers);
  }

  async workspaceUserUpdate(
    context: NcContext,
    param: {
      workspaceUsers: {
        user_id?: string;
        email?: string;
        workspace_role: string;
      }[];
      req: any;
      workspaceId: string;
    },
  ): Promise<any> {
    validatePayload(
      'swagger-v3.json#/components/schemas/WorkspaceUserUpdate',
      param.workspaceUsers,
      true,
    );

    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    try {
      for (const workspaceUser of param.workspaceUsers) {
        let userId = workspaceUser.user_id;

        if (!workspaceUser.user_id && workspaceUser.email) {
          const user = await User.getByEmail(workspaceUser.email, ncMeta);
          if (user) {
            userId = user.id;
          } else {
            NcError.userNotFound(workspaceUser.email);
          }
        }

        userIds.push(userId);

        await this.workspaceUsersService.update(
          {
            workspaceId: param.workspaceId,
            userId,
            roles: workspaceUser.workspace_role as WorkspaceUserRoles,
            siteUrl: param.req.ncSiteUrl,
            req: param.req,
          },
          ncMeta,
        );
      }

      await ncMeta.commit();
    } catch (e) {
      // on error rollback the transaction and throw the error
      await ncMeta.rollback();

      // Rollback cache, clear cache of updated users
      for (const userId of userIds) {
        await NocoCache.del(
          `${CacheScope.WORKSPACE_USER}:${param.workspaceId}:${userId}`,
        );
      }

      throw e;
    }
    // Get all users and filter by the ones we just updated
    const allUsers = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
      include_deleted: false,
    });

    const updatedUsers = allUsers.filter((user) =>
      userIds.includes(user.fk_user_id),
    );

    return this.builder().build(updatedUsers);
  }

  async workspaceUserDelete(
    context: NcContext,
    param: {
      workspaceUsers: {
        user_id?: string;
        email?: string;
        workspace_role: string;
      }[];
      workspaceId: string;
      req: any;
    },
  ): Promise<any> {
    validatePayload(
      'swagger-v3.json#/components/schemas/WorkspaceUserDelete',
      param.workspaceUsers,
      true,
    );

    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      for (const workspaceUser of param.workspaceUsers) {
        let userId = workspaceUser.user_id;

        if (!workspaceUser.user_id && workspaceUser.email) {
          const user = await User.getByEmail(workspaceUser.email, ncMeta);
          if (user) {
            userId = user.id;
          } else {
            NcError.userNotFound(workspaceUser.email);
          }
        }

        await this.workspaceUsersService.delete(
          {
            workspaceId: param.workspaceId,
            userId,
            req: param.req,
          },
          ncMeta,
        );
      }

      await ncMeta.commit();
    } catch (e) {
      // on error rollback the transaction and throw the error
      await ncMeta.rollback();
      throw e;
    }
    return {
      msg: 'The user has been deleted successfully',
    };
  }
}
