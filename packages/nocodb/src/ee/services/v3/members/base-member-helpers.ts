import { BaseMemberHelpers as BaseMemberHelpersCE } from 'src/services/v3/members/base-member-helpers';
import type { NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
import { BaseUser } from '~/models';
import WorkspaceUser from '~/models/WorkspaceUser';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { checkForFeature, PlanFeatureTypes } from '~/ee/helpers/paymentHelpers';

export class BaseMemberHelpers extends BaseMemberHelpersCE {
  constructor() {
    super();
    this.v3ResponseBuilder = builderGenerator({
      allowed: [
        'email',
        'display_name',
        'fk_user_id',
        'created_at',
        'updated_at',
        'roles',
        'workspace_roles',
      ],
      mappings: {
        fk_user_id: 'user_id',
        roles: 'base_role',
        workspace_roles: 'workspace_role',
      },
      excludeNullProps: true,
      // TODO: uncomment if workspace-level-no-access want to be excluded
      // transformFn: (user) => {
      //   if (user.workspace_role === 'workspace-level-no-access') {
      //     user.workspace_role = undefined;
      //   }
      //   return user;
      // },
    });
  }

  v3ResponseBuilder: () => ApiV3DataTransformationBuilder<any, any>;

  async getBaseMember(
    context: NcContext,
    param: {
      baseId: string;
      isPrivateBase?: boolean;
    },
    ncMeta?: MetaService,
  ) {
    await checkForFeature(
      context,
      PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT,
      ncMeta,
    );

    const baseUsers = await BaseUser.getUsersList(
      context,
      {
        base_id: param.baseId,
        // TODO: check user role to determine full or viewer
        mode: 'full',
        strict_in_record: true,
        skipOverridingWorkspaceRoles: true,
      },
      ncMeta,
    );
    let wsUsers = [];
    if (!param.isPrivateBase) {
      wsUsers = (
        await WorkspaceUser.userList({
          fk_workspace_id: context.workspace_id,
        })
      ).filter(
        (wsUser) =>
          !baseUsers.some(
            (baseUser) => wsUser.fk_user_id === baseUser.fk_user_id,
          ),
      );
    }

    return {
      individual_members: {
        base_members: baseUsers.map((user) =>
          this.transformBaseUserToResponse(user),
        ),
        workspace_members: wsUsers
          .map((user) => this.transformBaseUserToResponse(user))
          .map((user) => {
            const { base_role, ...result } = user;
            return {
              ...result,
              workspace_role: base_role,
            };
          }),
      },
    };
  }

  transformBaseUserToResponse(user: any) {
    return this.v3ResponseBuilder().build(user);
  }
}
