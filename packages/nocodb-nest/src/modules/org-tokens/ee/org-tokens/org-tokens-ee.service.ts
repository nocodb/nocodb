import { Injectable } from '@nestjs/common';
import { OrgUserRoles } from 'nocodb-sdk';
import { PagedResponseImpl } from '../../../../helpers/PagedResponse';
import { ApiToken } from '../../../../models';
import extractRolesObj from '../../../../utils/extractRolesObj';
import type { UserType } from 'nocodb-sdk';

@Injectable()
export class OrgTokensEeService {
  async apiTokenListEE(param: { user: UserType; query: any }) {
    let fk_user_id = param.user.id;

    // if super admin get all tokens
    if (extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN]) {
      fk_user_id = undefined;
    }

    return new PagedResponseImpl(
      await ApiToken.listWithCreatedBy({ ...param.query, fk_user_id }),
      {
        ...(param.query || {}),
        count: await ApiToken.count({}),
      },
    );
  }
}
