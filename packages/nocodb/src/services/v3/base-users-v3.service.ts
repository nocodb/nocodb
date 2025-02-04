import { Injectable, Logger } from '@nestjs/common';
import type {
  BaseUserCreateV3Type,
  BaseUserUpdateV3Type,
  ProjectUserReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { BaseUser, User } from '~/models';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { validatePayload } from '~/helpers';

@Injectable()
export class BaseUsersV3Service {
  protected readonly logger = new Logger(BaseUsersV3Service.name);
  protected builder: () => ApiV3DataTransformationBuilder<
    BaseUser,
    Partial<BaseUser>
  >;

  constructor(protected baseUsersService: BaseUsersService) {
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
        'display_name',
      ],
      mappings: {
        roles: 'base_role',
        workspace_roles: 'workspace_role',
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
      baseUsers: BaseUserCreateV3Type;
      req: NcRequest;
    },
  ): Promise<any> {
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseUserCreate',
      param.baseUsers,
      true,
    );

    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    try {
      for (const baseUser of param.baseUsers) {
        let user: User;
        if (baseUser.id) {
          user = await User.get(baseUser.id, ncMeta);
          if (!user) {
            NcError.userNotFound(baseUser.id);
          }
          baseUser.email = user.email;
        } else if (baseUser.email) {
          user = await User.getByEmail(baseUser.email, ncMeta);
        } else {
          NcError.badRequest('Either email or id is required');
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

  async baseUserUpdate(
    context: NcContext,
    param: {
      baseUsers: BaseUserUpdateV3Type;
      req: any;
      baseId: string;
    },
  ): Promise<any> {
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseUserUpdate',
      param.baseUsers,
      true,
    );

    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    try {
      for (const baseUser of param.baseUsers) {
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

        await this.baseUsersService.baseUserUpdate(
          context,
          {
            baseId: param.baseId,
            baseUser: {
              roles: baseUser.base_role as ProjectUserReqType['roles'],
            },
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
      baseUsers: any[];
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
