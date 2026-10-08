import { Injectable } from '@nestjs/common';
import { extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
import type { UserType } from 'nocodb-sdk';
import { extractApiTokenListQuery } from '~/helpers/apiTokenListQuery';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { ApiToken } from '~/models';

@Injectable()
export class OrgTokensEeService {
  async apiTokenListEE(param: {
    user: UserType;
    query: any;
    ssoClientId?: string;
  }) {
    let fk_user_id = param.user.id;

    // if super admin get all tokens
    if (extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN]) {
      fk_user_id = undefined;
    }

    // Visibility is decided here, not by the caller's query string.
    const filters = {
      fk_user_id,
      ssoClientId: param.ssoClientId,
      // A super admin already sees unowned tokens through `fk_user_id`
      // being undefined; nobody else may ask for them.
      includeUnmappedToken: false,
    };

    const { limit, offset } = extractApiTokenListQuery(param.query);

    return new PagedResponseImpl(
      await ApiToken.listWithCreatedBy({ ...filters, limit, offset }),
      {
        limit,
        offset,
        count: await ApiToken.count(filters),
      },
    );
  }
}
