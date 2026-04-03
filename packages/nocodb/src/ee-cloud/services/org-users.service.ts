import { Injectable } from '@nestjs/common';
import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { OrgUserReqType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { OrgUser, PresignedUrl, User, Workspace } from '~/models';
import WorkspaceUser from '~/ee/models/WorkspaceUser';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class OrgUsersService {
  constructor() {}

  async addUserToOrg(param: {
    userId: string;
    orgId: string;
    userProps: OrgUserReqType;
    req: NcRequest;
  }) {
    // OrgUser.get() returns null for soft-deleted rows
    const orgUser = await OrgUser.get(param.orgId, param.userId);

    if (orgUser) {
      NcError.badRequest('User already exists in the organization');
    }

    const user = await User.get(param.userId);

    if (!user) {
      NcError.notFound('User not found');
    }

    // Check for soft-deleted row and reactivate
    const ncMeta = Noco.ncMeta;
    const softDeleted = await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', param.orgId)
      .where('fk_user_id', param.userId)
      .where('deleted', true)
      .first();

    if (softDeleted) {
      await ncMeta
        .knexConnection(MetaTable.ORG_USERS)
        .where('fk_org_id', param.orgId)
        .where('fk_user_id', param.userId)
        .update({
          deleted: false,
          deleted_at: null,
          roles: param.userProps.roles || EnterpriseOrgUserRoles.CREATOR,
        });
    } else {
      await OrgUser.insert({
        fk_org_id: param.orgId,
        fk_user_id: param.userId,
        roles: param.userProps.roles,
      });
    }

    return { msg: 'User added to organization' };
  }

  async getOrgUsers(param: { orgId: string; req: NcRequest; user: User }) {
    const orgUsers = await OrgUser.list(param.orgId);

    await PresignedUrl.signMetaIconImage(orgUsers);

    return orgUsers;
  }

  async removeUserFromOrg(param: {
    userId: string;
    orgId: string;
    req: NcRequest;
  }) {
    const orgUser = await OrgUser.get(param.orgId, param.userId);

    if (!orgUser) {
      NcError.notFound('User not found in organization');
    }

    // Prevent removing the last admin/owner
    const ncMeta = Noco.ncMeta;
    const admins = await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', param.orgId)
      .where('roles', EnterpriseOrgUserRoles.ADMIN)
      .where(function () {
        this.where('deleted', false).orWhereNull('deleted');
      });

    if (admins.length <= 1 && admins[0]?.fk_user_id === param.userId) {
      NcError.badRequest('Cannot remove the last org admin');
    }

    // Soft-delete from org
    await OrgUser.softDelete(param.orgId, param.userId);

    // Remove from all workspaces in this org
    const ncMeta = Noco.ncMeta;
    const orgWorkspaces = await ncMeta
      .knexConnection(MetaTable.WORKSPACE)
      .where('fk_org_id', param.orgId)
      .where(function () {
        this.where('deleted', false).orWhereNull('deleted');
      })
      .select('id');

    for (const ws of orgWorkspaces) {
      await WorkspaceUser.softDelete(ws.id, param.userId, ncMeta);
    }

    return { msg: 'User removed from organization' };
  }

  async updateUserRoleInOrg(param: {
    userId: string;
    orgId: string;
    orgRole: EnterpriseOrgUserRoles;
    req: NcRequest;
  }) {
    const orgUser = await OrgUser.get(param.orgId, param.userId);

    if (!orgUser) {
      NcError.notFound('User not found in organization');
    }

    await OrgUser.update(param.userId, param.orgId, {
      roles: param.orgRole,
    } as any);

    return { msg: 'User role updated' };
  }
}
