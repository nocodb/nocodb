import { Injectable } from '@nestjs/common';
import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { OrgUserReqType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { OrgUser, PresignedUrl, User } from '~/models';

@Injectable()
export class OrgUsersService {
  constructor() {}

  async addUserToOrg(param: {
    userId: string;
    orgId: string;
    userProps: OrgUserReqType;
    req: NcRequest;
  }) {
    const orgUser = await OrgUser.get(param.orgId, param.userId);

    if (orgUser) {
      NcError.badRequest('User already exists in the organization');
    }

    const user = await User.get(param.userId);

    if (!user) {
      NcError.notFound('User not found');
    }

    await OrgUser.insert({
      fk_org_id: param.orgId,
      fk_user_id: param.userId,
      roles: param.userProps.roles,
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

    await OrgUser.softDelete(param.orgId, param.userId);

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
