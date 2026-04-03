import { Injectable } from '@nestjs/common';
import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import { OrgUsersService as OrgUsersServiceCE } from 'src/services/org-users.service';
import { MetaTable, NC_DEFAULT_ORG_ID } from '~/utils/globals';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { PresignedUrl } from '~/models';
import OrgUser from '~/ee/models/OrgUser';
import WorkspaceUser from '~/ee/models/WorkspaceUser';

@Injectable()
export class OrgUsersService extends OrgUsersServiceCE {
  /**
   * On-prem override: read users from nc_org_users for the default org.
   * Returns org role alongside user info.
   */
  async userList(param: { query: Record<string, any> }) {
    const orgId = Noco.ncDefaultOrgId || NC_DEFAULT_ORG_ID;
    const { limit = 25, offset = 0, query: searchQuery } = param.query;

    const ncMeta = Noco.ncMeta;

    let qb = ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.email_verified`,
        `${MetaTable.USERS}.invite_token`,
        `${MetaTable.USERS}.created_at`,
        `${MetaTable.USERS}.updated_at`,
        `${MetaTable.USERS}.roles`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.meta`,
        `${MetaTable.ORG_USERS}.roles as org_roles`,
      )
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
      qb = qb.where(function () {
        this.where(`${MetaTable.USERS}.email`, 'like', `%${searchQuery}%`).orWhere(
          `${MetaTable.USERS}.display_name`,
          'like',
          `%${searchQuery}%`,
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
      countQb.where(function () {
        this.where(`${MetaTable.USERS}.email`, 'like', `%${searchQuery}%`).orWhere(
          `${MetaTable.USERS}.display_name`,
          'like',
          `%${searchQuery}%`,
        );
      });
    }

    const [users, countResult] = await Promise.all([
      qb.orderBy(`${MetaTable.USERS}.created_at`, 'desc').limit(limit).offset(offset),
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
   * Update org role for a user in the default org.
   */
  async updateOrgRole(param: { userId: string; orgRole: EnterpriseOrgUserRoles }) {
    const orgId = Noco.ncDefaultOrgId || NC_DEFAULT_ORG_ID;

    const allowedRoles = [
      EnterpriseOrgUserRoles.OWNER,
      EnterpriseOrgUserRoles.CREATOR,
      EnterpriseOrgUserRoles.VIEWER,
    ];

    if (!allowedRoles.includes(param.orgRole)) {
      NcError.badRequest(`Invalid org role: ${param.orgRole}`);
    }

    const ncMeta = Noco.ncMeta;

    await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', orgId)
      .where('fk_user_id', param.userId)
      .update({ roles: param.orgRole });
  }

  /**
   * Remove user from org: soft-delete org membership + remove from
   * all workspaces and bases in the org.
   */
  async removeFromOrg(param: { userId: string }) {
    const orgId = Noco.ncDefaultOrgId || NC_DEFAULT_ORG_ID;
    const ncMeta = Noco.ncMeta;

    // Prevent removing the last owner
    const owners = await ncMeta
      .knexConnection(MetaTable.ORG_USERS)
      .where('fk_org_id', orgId)
      .where('roles', EnterpriseOrgUserRoles.OWNER)
      .where(function () {
        this.where('deleted', false).orWhereNull('deleted');
      });

    if (
      owners.length <= 1 &&
      owners[0]?.fk_user_id === param.userId
    ) {
      NcError.badRequest('Cannot remove the last org owner');
    }

    // Soft-delete from org
    await OrgUser.softDelete(orgId, param.userId, ncMeta);

    // Remove from all workspaces in this org
    const orgWorkspaces = await ncMeta
      .knexConnection(MetaTable.WORKSPACE)
      .where('fk_org_id', orgId)
      .where(function () {
        this.where('deleted', false).orWhereNull('deleted');
      })
      .select('id');

    for (const ws of orgWorkspaces) {
      await WorkspaceUser.softDelete(ws.id, param.userId, ncMeta);
    }
  }
}
