import { BaseMemberHelpers as BaseMemberHelpersCE } from 'src/services/v3/members/base-member-helpers';
import type { NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import { BaseUser } from '~/models';
import WorkspaceUser from '~/models/WorkspaceUser';

export class BaseMemberHelpers extends BaseMemberHelpersCE {
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
    const wsUsers = (
      await WorkspaceUser.userList({
        fk_workspace_id: context.workspace_id,
      })
    ).filter(
      (wsUser) =>
        !baseUsers.some(
          (baseUser) => wsUser.fk_user_id === baseUser.fk_user_id,
        ),
    );

    return {
      individual_members: {
        // TODO: conversion to v3 format
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
}
