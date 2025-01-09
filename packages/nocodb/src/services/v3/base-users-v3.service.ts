import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  extractRolesObj,
  OrgUserRoles,
  PluginCategory,
  ProjectRoles, WorkspaceUserRoles,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as ejs from 'ejs';
import validator from 'validator';
import type {
  ProjectUserDeleteV3ReqType,
  ProjectUserReqType,
  ProjectUserV3ReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { randomTokenString } from '~/helpers/stringHelpers';
import { Base, BaseUser, User } from '~/models';
import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { getProjectRolePower } from '~/utils/roleHelper';
import { sanitiseEmailContent } from '~/utils';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { WorkspaceUsersService } from '~/ee/services/workspace-users.service';

@Injectable()
export class BaseUsersV3Service {
  private readonly logger = new Logger(BaseUsersV3Service.name);
  private builder: () => ApiV3DataTransformationBuilder;

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
        'base_role',
        'workspace_role',
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

    return { users: this.builder().build(baseUsers) };
  }

  async userInvite(
    context: NcContext,
    param: {
      baseId: string;
      baseUsers: ProjectUserV3ReqType[];
      req: NcRequest;
    },
  ): Promise<any> {
    for (const baseUser of param.baseUsers) {
      validatePayload(
        'swagger.json#/components/schemas/ProjectUserV3Req',
        baseUser,
      );

      if (baseUser.workspace_role) {
        await this.workspaceUsersService.invite( {
          body: {
            role: baseUser.workspace_role,
            email: baseUser.email,
          },
          siteUrl: param.req.ncSiteUrl,
          invitedBy: param.req.user,
          req: param.req,
          workspaceId: param.req.ncWorkspaceId,
        });
      }

      await this.baseUsersService.userInvite(context, {
        baseId: param.baseId,
        baseUser: {
          email: baseUser.email,
          roles: baseUser.base_role as ProjectUserReqType['roles'],
        },
        req: param.req,
      });
    }
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
    for (const baseUser of param.baseUsers) {
      validatePayload(
        'swagger.json#/components/schemas/ProjectUserV3Req',
        baseUser,
      );

      if (baseUser.workspace_role) {
        if (baseUser.id) {
          await this.workspaceUsersService.update({
            userId: baseUser.id,
            req: param.req,
            workspaceId: param.req.ncWorkspaceId,
            roles: baseUser.workspace_role as WorkspaceUserRoles,
            siteUrl: param.req.ncSiteUrl,
          });
        } else {
          await this.workspaceUsersService.invite({
            body: {
              role: baseUser.workspace_role,
              email: baseUser.email,
            },
            invitedBy: param.req.user,
            req: param.req,
            workspaceId: param.req.ncWorkspaceId,
            siteUrl: param.req.ncSit
          });
        }
      }

      if (baseUser.id) {
        await this.baseUsersService.baseUserUpdate(context, {
          baseId: param.baseId,
          baseUser: {
            roles: baseUser.base_role as ProjectUserReqType['roles'],
          },
          userId: baseUser.id,
          req: param.req,
        });
      } else {
        await this.baseUsersService.userInvite(context, {
          baseId: param.baseId,
          baseUser: {
            email: baseUser.email,
            roles: baseUser.base_role as ProjectUserReqType['roles'],
          },
          req: param.req,
        });
      }
    }
  }

  async baseUserDelete(
    context: NcContext,
    param: {
      baseUsers: ProjectUserDeleteV3ReqType[];
      baseId: string;
      req: any;
    },
  ): Promise<any> {
    for (const baseUser of param.baseUsers) {
      validatePayload(
        'swagger.json#/components/schemas/ProjectUserDeleteV3Req',
        baseUser,
      );

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
        userId: baseUser.id,
        req: param.req,
      });
    }
  }
}
