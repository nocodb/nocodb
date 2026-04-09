import { Injectable } from '@nestjs/common';
import { AppEvents, EnterpriseOrgUserRoles } from 'nocodb-sdk';
import { OrgUsersService as OrgUsersServiceCE } from 'src/services/org-users.service';
import type { NcRequest } from '~/interface/config';
import { MetaTable, NC_DEFAULT_ORG_ID } from '~/utils/globals';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { PresignedUrl } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { MailService } from '~/services/mail/mail.service';
import { PaymentService } from '~/modules/payment/payment.service';
import { removeUserFromOrgCascade } from '~/ee/helpers/orgUserRemovalHelper';

@Injectable()
export class OrgUsersService extends OrgUsersServiceCE {
  constructor(
    protected readonly baseUsersService: BaseUsersService,
    protected readonly appHooksService: AppHooksService,
    protected readonly mailService: MailService,
    protected readonly paymentService: PaymentService,
  ) {
    super(baseUsersService, appHooksService, mailService);
  }

  /**
   * On-prem override: read users from nc_org_users for the default org.
   * Falls back to CE user list when unlicensed (no org exists).
   */
  async userList(param: { query: Record<string, any>; reqUser?: any }) {
    // Unlicensed — fall through to CE user list from nc_users
    if (!Noco.isEE() || !Noco.ncDefaultOrgId) {
      return super.userList(param);
    }

    const orgId = Noco.ncDefaultOrgId;
    const { limit = 25, offset = 0, query: searchQuery } = param.query;
    const isSuperAdmin = param.reqUser?.roles?.includes?.('super');

    const ncMeta = Noco.ncMeta;

    const selectCols = [
      `${MetaTable.USERS}.id`,
      `${MetaTable.USERS}.email`,
      `${MetaTable.USERS}.email_verified`,
      `${MetaTable.USERS}.created_at`,
      `${MetaTable.USERS}.updated_at`,
      `${MetaTable.USERS}.roles`,
      `${MetaTable.USERS}.display_name`,
      `${MetaTable.USERS}.meta`,
      `${MetaTable.ORG_USERS}.roles as org_roles`,
      `${MetaTable.ORG_USERS}.scim_managed`,
    ];

    if (isSuperAdmin) {
      selectCols.push(`${MetaTable.USERS}.invite_token`);
    }

    let qb = ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .select(...selectCols)
      .innerJoin(
        MetaTable.USERS,
        `${MetaTable.ORG_USERS}.fk_user_id`,
        `${MetaTable.USERS}.id`,
      )
      .where(`${MetaTable.ORG_USERS}.fk_org_id`, orgId)
      .where(function () {
        this.where(`${MetaTable.ORG_USERS}.deleted`, false).orWhereNull(
          `${MetaTable.ORG_USERS}.deleted`,
        );
      })
      .where(function () {
        this.where(`${MetaTable.USERS}.is_deleted`, false).orWhereNull(
          `${MetaTable.USERS}.is_deleted`,
        );
      });

    if (searchQuery) {
      const likeVal = `%${searchQuery
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')}%`;
      qb = qb.where(function () {
        this.where(`${MetaTable.USERS}.email`, 'like', likeVal).orWhere(
          `${MetaTable.USERS}.display_name`,
          'like',
          likeVal,
        );
      });
    }

    // Count query
    const countQb = ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .innerJoin(
        MetaTable.USERS,
        `${MetaTable.ORG_USERS}.fk_user_id`,
        `${MetaTable.USERS}.id`,
      )
      .where(`${MetaTable.ORG_USERS}.fk_org_id`, orgId)
      .where(function () {
        this.where(`${MetaTable.ORG_USERS}.deleted`, false).orWhereNull(
          `${MetaTable.ORG_USERS}.deleted`,
        );
      })
      .where(function () {
        this.where(`${MetaTable.USERS}.is_deleted`, false).orWhereNull(
          `${MetaTable.USERS}.is_deleted`,
        );
      })
      .count('* as count')
      .first();

    if (searchQuery) {
      const likeVal = `%${searchQuery
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')}%`;
      countQb.where(function () {
        this.where(`${MetaTable.USERS}.email`, 'like', likeVal).orWhere(
          `${MetaTable.USERS}.display_name`,
          'like',
          likeVal,
        );
      });
    }

    const [users, countResult] = await Promise.all([
      qb
        .orderBy(`${MetaTable.USERS}.created_at`, 'desc')
        .limit(limit)
        .offset(offset),
      countQb,
    ]);

    await PresignedUrl.signMetaIconImage(users);

    return {
      list: users,
      pageInfo: {
        totalRows: Number((countResult as any)?.count || 0),
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        isFirstPage: offset === 0,
        isLastPage: offset + limit >= Number((countResult as any)?.count || 0),
      },
    };
  }

  /**
   * Add an existing user to the org. User must already exist in nc_users.
   */
  async addToOrg(param: {
    email: string;
    orgRole?: EnterpriseOrgUserRoles;
    req: NcRequest;
  }) {
    const orgId = Noco.ncDefaultOrgId || NC_DEFAULT_ORG_ID;
    const ncMeta = Noco.ncMeta;

    // Find user by email
    const user = await ncMeta
      .knexConnection(MetaTable.USERS)
      .where('email', param.email.toLowerCase().trim())
      .where(function () {
        this.where('is_deleted', false).orWhereNull('is_deleted');
      })
      .first();

    if (!user) {
      NcError.badRequest('User not found');
    }

    // Validate org role
    if (param.orgRole) {
      const allowedRoles = [
        EnterpriseOrgUserRoles.ADMIN,
        EnterpriseOrgUserRoles.CREATOR,
        EnterpriseOrgUserRoles.VIEWER,
      ];
      if (!allowedRoles.includes(param.orgRole)) {
        NcError.badRequest(`Invalid org role: ${param.orgRole}`);
      }
    }

    // Single query to find any existing row (active or soft-deleted)
    const existingRow = await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', orgId)
      .where('fk_user_id', user.id)
      .first();

    if (existingRow && !existingRow.deleted) {
      NcError.badRequest('User already in organization');
    }

    const role = param.orgRole || EnterpriseOrgUserRoles.VIEWER;

    if (existingRow?.deleted) {
      // Reactivate soft-deleted row
      await ncMeta
        .knexConnection(MetaTable.ORG_USERS)
        .where('fk_org_id', orgId)
        .where('fk_user_id', user.id)
        .update({
          deleted: false,
          deleted_at: null,
          roles: role,
        });
    } else {
      await ncMeta.knexConnection(MetaTable.ORG_USERS).insert({
        fk_org_id: orgId,
        fk_user_id: user.id,
        roles: role,
      });
    }

    this.appHooksService.emit(AppEvents.ORG_USER_ADD, {
      userId: user.id,
      orgId,
      role,
      req: param.req,
    });

    return { msg: 'User added to organization' };
  }

  /**
   * Update org role for a user in the default org.
   */
  async updateOrgRole(param: {
    userId: string;
    orgRole: EnterpriseOrgUserRoles;
    req?: NcRequest;
  }) {
    const orgId = Noco.ncDefaultOrgId || NC_DEFAULT_ORG_ID;

    const allowedRoles = [
      EnterpriseOrgUserRoles.ADMIN,
      EnterpriseOrgUserRoles.CREATOR,
      EnterpriseOrgUserRoles.VIEWER,
    ];

    if (!allowedRoles.includes(param.orgRole)) {
      NcError.badRequest(`Invalid org role: ${param.orgRole}`);
    }

    const ncMeta = Noco.ncMeta;

    // Block demoting the last admin
    const currentRole = await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', orgId)
      .where('fk_user_id', param.userId)
      .first();

    if (
      currentRole?.roles === EnterpriseOrgUserRoles.ADMIN &&
      param.orgRole !== EnterpriseOrgUserRoles.ADMIN
    ) {
      const admins = await ncMeta
        .knexConnection(MetaTable.ORG_USERS)
        .where('fk_org_id', orgId)
        .where('roles', EnterpriseOrgUserRoles.ADMIN)
        .where(function () {
          this.where('deleted', false).orWhereNull('deleted');
        });

      if (admins.length <= 1) {
        NcError.badRequest('Cannot demote the last org admin');
      }
    }

    const oldRole = currentRole?.roles;

    await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', orgId)
      .where('fk_user_id', param.userId)
      .update({ roles: param.orgRole });

    this.appHooksService.emit(AppEvents.ORG_USER_UPDATE, {
      userId: param.userId,
      orgId,
      oldRole,
      newRole: param.orgRole,
      req: param.req,
    });
  }

  /**
   * Remove user from org: soft-delete org membership + remove from
   * all workspaces and bases in the org.
   */
  async removeFromOrg(param: { userId: string; req?: NcRequest }) {
    const orgId = Noco.ncDefaultOrgId || NC_DEFAULT_ORG_ID;
    const ncMeta = Noco.ncMeta;

    // Prevent removing the last owner
    const owners = await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', orgId)
      .where('roles', EnterpriseOrgUserRoles.ADMIN)
      .where(function () {
        this.where('deleted', false).orWhereNull('deleted');
      });

    if (owners.length <= 1 && owners[0]?.fk_user_id === param.userId) {
      NcError.badRequest('Cannot remove the last org owner');
    }

    await removeUserFromOrgCascade(orgId, param.userId, ncMeta);

    // Reseat org subscription after user removal
    await this.paymentService.reseatSubscription(orgId);

    this.appHooksService.emit(AppEvents.ORG_USER_REMOVE, {
      userId: param.userId,
      orgId,
      req: param.req,
    });
  }
}
