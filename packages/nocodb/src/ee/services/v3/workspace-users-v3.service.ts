import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from 'src/interface/config';
import type { ApiV3DataTransformationBuilder } from 'src/utils/api-v3-data-transformation.builder';
import Noco from 'src/Noco';
import { NcError } from 'src/helpers/catchError';
import { User } from 'src/models';
import { builderGenerator } from 'src/utils/api-v3-data-transformation.builder';
import { WorkspaceUsersService } from 'src/ee/services/workspace-users.service';
import { validatePayload } from 'src/helpers';
import WorkspaceUser from 'src/ee/models/WorkspaceUser';
import { WorkspaceUserRoles } from 'nocodb-sdk';

@Injectable()
export class WorkspaceUsersV3Service {
  protected readonly logger = new Logger(WorkspaceUsersV3Service.name);
  protected builder: () => ApiV3DataTransformationBuilder<
    WorkspaceUser,
    Partial<WorkspaceUser>
  >;

  constructor(protected workspaceUsersService: WorkspaceUsersService) {
    this.builder = builderGenerator({
      allowed: [
        'id',
        'email',
        'name',
        'created_at',
        'updated_at',
        'workspace_roles',
        'workspace_id',
        'display_name',
        'invite_accepted',
        'invite_token',
      ],
      mappings: {
        workspace_roles: 'roles',
        display_name: 'name',
      },
      transformFn(data) {
        if (!data.name) {
          data.name = undefined;
        }
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
      workspaceUsers: any[];
      req: NcRequest;
    },
  ): Promise<any> {
    validatePayload(
      'swagger-v3.json#/components/schemas/WorkspaceUserCreate',
      param.workspaceUsers,
      true,
    );

    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    try {
      for (const workspaceUser of param.workspaceUsers) {
        let user: User;
        if (workspaceUser.id) {
          user = await User.get(workspaceUser.id, ncMeta);
          if (!user) {
            NcError.userNotFound(workspaceUser.id);
          }
          workspaceUser.email = user.email;
        } else if (workspaceUser.email) {
          user = await User.getByEmail(workspaceUser.email, ncMeta);
        } else {
          NcError.badRequest('Either email or id is required');
        }

        // Set default role if not provided
        if (!workspaceUser.workspace_role) {
          workspaceUser.workspace_role = WorkspaceUserRoles.NO_ACCESS;
        }

        await this.workspaceUsersService.invite(
          {
            workspaceId: param.workspaceId,
            body: {
              email: workspaceUser.email,
              roles: workspaceUser.workspace_role,
            },
            siteUrl: param.req.ncSiteUrl,
            invitedBy: param.req.user,
            req: param.req,
          },
          ncMeta,
        );

        user = await User.getByEmail(workspaceUser.email, ncMeta);
        userIds.push(user.id);
      }
      await ncMeta.commit();
    } catch (e) {
      // on error rollback the transaction and throw the error
      await ncMeta.rollback();
      throw e;
    }
    // Get all users and filter by the ones we just invited
    const allUsers = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
      include_deleted: false,
    });
    
    const invitedUsers = allUsers.filter(user => userIds.includes(user.fk_user_id));
    
    return this.builder().build(invitedUsers);
  }

  async workspaceUserUpdate(
    context: NcContext,
    param: {
      workspaceUsers: any[];
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
        let userId = workspaceUser.id;

        if (!workspaceUser.id && workspaceUser.email) {
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
            roles: workspaceUser.workspace_role,
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
      throw e;
    }
    // Get all users and filter by the ones we just updated
    const allUsers = await WorkspaceUser.userList({
      fk_workspace_id: param.workspaceId,
      include_deleted: false,
    });
    
    const updatedUsers = allUsers.filter(user => userIds.includes(user.fk_user_id));
    
    return this.builder().build(updatedUsers);
  }

  async workspaceUserDelete(
    context: NcContext,
    param: {
      workspaceUsers: any[];
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
        let userId = workspaceUser.id;

        if (!workspaceUser.id && workspaceUser.email) {
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
