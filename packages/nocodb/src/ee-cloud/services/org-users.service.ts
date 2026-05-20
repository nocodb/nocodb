import { Injectable } from '@nestjs/common';
import { AppEvents, EnterpriseOrgUserRoles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { OrgUserListItemType, OrgUserReqType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { OrgUser, PresignedUrl, User } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PaymentService } from '~/modules/payment/payment.service';
import { removeUserFromOrgCascade } from '~/ee/helpers/orgUserRemovalHelper';

@Injectable()
export class OrgUsersService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly paymentService: PaymentService,
  ) {}

  /**
   * Defense-in-depth: ACL already gates these endpoints to
   * `CloudOrgUserRoles.OWNER`, but assigning the ADMIN role is a privilege
   * escalation, so confirm the requester is themselves an org admin at the
   * service layer too.
   */
  protected async assertRequesterIsOrgAdmin(
    orgId: string,
    req: NcRequest,
  ): Promise<void> {
    const requesterId = req?.user?.id;
    if (!requesterId) {
      NcError.forbidden('Only org admins can assign the admin role');
    }
    const requester = await OrgUser.get(orgId, requesterId);
    if (
      !requester ||
      (requester.roles !== EnterpriseOrgUserRoles.ADMIN &&
        requester.roles !== EnterpriseOrgUserRoles.OWNER)
    ) {
      NcError.forbidden('Only org admins can assign the admin role');
    }
  }

  async addUserToOrg(param: {
    userId: string;
    orgId: string;
    userProps: OrgUserReqType;
    req: NcRequest;
  }) {
    // Validate org role
    if (param.userProps.roles) {
      const allowedRoles = [
        EnterpriseOrgUserRoles.ADMIN,
        EnterpriseOrgUserRoles.CREATOR,
        EnterpriseOrgUserRoles.VIEWER,
      ];
      if (
        !allowedRoles.includes(param.userProps.roles as EnterpriseOrgUserRoles)
      ) {
        NcError.badRequest(`Invalid org role: ${param.userProps.roles}`);
      }
    }

    if (param.userProps.roles === EnterpriseOrgUserRoles.ADMIN) {
      await this.assertRequesterIsOrgAdmin(param.orgId, param.req);
    }

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

  async getOrgUsers(param: {
    orgId: string;
    req: NcRequest;
    user: User;
    excludeWorkspaceId?: string;
    excludeBaseId?: string;
  }): Promise<OrgUserListItemType[]> {
    const orgUsers = (await OrgUser.list(param.orgId)) as OrgUserListItemType[];

    const excludedUserIds = await this.getExcludedUserIds({
      excludeWorkspaceId: param.excludeWorkspaceId,
      excludeBaseId: param.excludeBaseId,
    });

    const filtered = excludedUserIds.size
      ? orgUsers.filter((u) => !excludedUserIds.has(u.id))
      : orgUsers;

    await PresignedUrl.signMetaIconImage(filtered);

    return filtered;
  }

  /**
   * Returns a set of user IDs that are already members of the given workspace
   * or base — used to filter the invite picker list. The picker only ever
   * shows users in `OrgUser.list(orgId)`, so a cross-org workspace/base id
   * just produces an exclude set that has no overlap with the candidate list
   * (no users removed). No need to verify the id's org here.
   */
  protected async getExcludedUserIds(param: {
    excludeWorkspaceId?: string;
    excludeBaseId?: string;
  }): Promise<Set<string>> {
    const ids = new Set<string>();

    if (!param.excludeWorkspaceId && !param.excludeBaseId) return ids;

    const ncMeta = Noco.ncMeta;

    if (param.excludeWorkspaceId) {
      const rows = await ncMeta
        .knexConnection(MetaTable.WORKSPACE_USER)
        .select('fk_user_id')
        .where('fk_workspace_id', param.excludeWorkspaceId)
        .where(function () {
          this.where('deleted', false).orWhereNull('deleted');
        });
      for (const r of rows) ids.add(r.fk_user_id);
    }

    if (param.excludeBaseId) {
      const rows = await ncMeta
        .knexConnection(MetaTable.PROJECT_USERS)
        .select('fk_user_id')
        .where('base_id', param.excludeBaseId);
      for (const r of rows) ids.add(r.fk_user_id);
    }

    return ids;
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

    // Reseat org subscription after user removal
    await this.paymentService.reseatSubscription(param.orgId);

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

    if (
      param.orgRole === EnterpriseOrgUserRoles.ADMIN &&
      orgUser.roles !== EnterpriseOrgUserRoles.ADMIN
    ) {
      await this.assertRequesterIsOrgAdmin(param.orgId, param.req);
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
