import { Injectable, Logger } from '@nestjs/common';
import { V3_META_REQUEST_LIMIT } from 'src/constants';
import type {
  BaseMemberCreateV3Type,
  BaseMemberUpdateV3Type,
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
export class BaseMembersV3Service {
  protected readonly logger = new Logger(BaseMembersV3Service.name);
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
        id: 'user_id',
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
      baseMembers: BaseMemberCreateV3Type;
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
    try {
      for (const baseUser of param.baseMembers) {
        let user: User;
        let userEmail: string;

        if ('user_id' in baseUser && baseUser.user_id) {
          user = await User.get(baseUser.user_id, ncMeta);
          if (!user) {
            NcError.get(context).userNotFound(baseUser.user_id);
          }
          userEmail = user.email;
        } else if ('email' in baseUser && baseUser.email) {
          user = await User.getByEmail(baseUser.email, ncMeta);
          userEmail = baseUser.email;
        } else {
          NcError.get(context).invalidRequestBody(
            'Either email or id is required',
          );
        }

        await this.baseUsersService.userInvite(
          context,
          {
            baseId: param.baseId,
            baseUser: {
              email: userEmail,
              roles: baseUser.base_role as ProjectUserReqType['roles'],
            },
            req: param.req,
          },
          ncMeta,
        );

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

  async baseMemberUpdate(
    context: NcContext,
    param: {
      baseMembers: BaseMemberUpdateV3Type;
      req: any;
      baseId: string;
    },
  ): Promise<any> {
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseMemberUpdate',
      param.baseMembers,
      true,
      context,
    );

    if (param.baseMembers?.length > V3_META_REQUEST_LIMIT) {
      NcError.get(context).maxInsertLimitExceeded(V3_META_REQUEST_LIMIT);
    }
    const ncMeta = await Noco.ncMeta.startTransaction();
    const userIds = [];
    try {
      for (const baseUser of param.baseMembers) {
        const userId = baseUser.user_id;
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
