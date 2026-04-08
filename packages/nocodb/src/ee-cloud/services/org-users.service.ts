import { Injectable } from '@nestjs/common';
import { AppEvents, EnterpriseOrgUserRoles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { OrgUserReqType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { OrgUser, PresignedUrl, User, Workspace } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { removeUserFromOrgCascade } from '~/ee/helpers/orgUserRemovalHelper';

@Injectable()
export class OrgUsersService {
  constructor(protected readonly appHooksService: AppHooksService) {}

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
          roles: param.userProps.roles || EnterpriseOrgUserRoles.VIEWER,
        });
    } else {
      await OrgUser.insert({
        fk_org_id: param.orgId,
        fk_user_id: param.userId,
        roles: param.userProps.roles,
      });
    }

    this.appHooksService.emit(AppEvents.ORG_USER_ADD, {
      userId: param.userId,
      orgId: param.orgId,
      role: param.userProps.roles || EnterpriseOrgUserRoles.VIEWER,
      req: param.req,
    });

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

    await removeUserFromOrgCascade(param.orgId, param.userId, ncMeta);

    this.appHooksService.emit(AppEvents.ORG_USER_REMOVE, {
      userId: param.userId,
      orgId: param.orgId,
      req: param.req,
    });

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

    // Block demoting the last admin
    if (
      orgUser.roles === EnterpriseOrgUserRoles.ADMIN &&
      param.orgRole !== EnterpriseOrgUserRoles.ADMIN
    ) {
      const ncMeta = Noco.ncMeta;
      const admins = await ncMeta
        .knexConnection(MetaTable.ORG_USERS)
        .where('fk_org_id', param.orgId)
        .where('roles', EnterpriseOrgUserRoles.ADMIN)
        .where(function () {
          this.where('deleted', false).orWhereNull('deleted');
        });

      if (admins.length <= 1) {
        NcError.badRequest('Cannot demote the last org admin');
      }
    }

    const oldRole = orgUser.roles;

    await OrgUser.update(param.userId, param.orgId, {
      roles: param.orgRole as string,
    });

    this.appHooksService.emit(AppEvents.ORG_USER_UPDATE, {
      userId: param.userId,
      orgId: param.orgId,
      oldRole,
      newRole: param.orgRole,
      req: param.req,
    });

    return { msg: 'User role updated' };
  }
}
