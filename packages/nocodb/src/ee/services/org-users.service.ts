import { Injectable } from '@nestjs/common';
import type { NcRequest } from '../../interface/config';
import type { OrgUserReqType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { OrgUser, User } from '~/models';

@Injectable()
export class OrgUsersService {
  constructor() {}

  // add user to org
  async addUserToOrg(param: {
    userId: string;
    orgId: string;
    userProps: OrgUserReqType;
    req: NcRequest;
  }) {
    // check user already exists in org
    const orgUser = await OrgUser.get(param.orgId, param.userId);

    if (orgUser) {
      NcError.badRequest('User already exists in the organization');
    }

    // check if user exists
    const user = await User.get(param.userId);

    if (!user) {
      NcError.notFound('User not found');
    }

    // add user to org
    await OrgUser.insert({
      fk_org_id: param.orgId,
      fk_user_id: param.userId,
      roles: param.userProps.roles,
    });

    // return success

    return Promise.resolve(undefined);
  }

  async getOrgUsers(param: { orgId: string; req: NcRequest; user: User }) {
    // get all users in org
    return await OrgUser.list(param.orgId);
  }

  // remove user from org
  async removeUserFromOrg(_param: {
    userId: string;
    orgId: string;
    req: NcRequest;
  }) {
    return Promise.resolve(undefined);
  }

  // update user role in org
  async updateUserRoleInOrg(_param: {
    user: any;
    orgId: string;
    req: NcRequest;
  }) {
    return Promise.resolve(undefined);
  }
}
