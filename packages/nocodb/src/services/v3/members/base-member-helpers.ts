import type { NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
import { BaseUser } from '~/models';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';

export class BaseMemberHelpers {
  constructor() {
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
    },
    ncMeta?: MetaService,
  ) {
    const baseUsers = await BaseUser.getUsersList(
      context,
      {
        base_id: param.baseId,
        // TODO: check user role to determine full or viewer
        mode: 'full',
        strict_in_record: true,
      },
      ncMeta,
    );

    return {
      individual_members: {
        // TODO: conversion to v3 format
        base_members: baseUsers.map((user) =>
          this.transformBaseUserToResponse(user),
        ),
      },
    };
  }

  transformBaseUserToResponse(user: any) {
    return this.v3ResponseBuilder().build(user);
  }
}
