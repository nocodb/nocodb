import { OrgUserRoles } from 'nocodb-sdk';
import { PagedResponseImpl } from '../../meta/helpers/PagedResponse';
import { ApiToken } from '../../models';
import type { UserType } from 'nocodb-sdk';

export async function apiTokenListEE(param: { user: UserType; query: any }) {
  let fk_user_id = param.user.id;

  // if super admin get all tokens
  if (param.user.roles.includes(OrgUserRoles.SUPER_ADMIN)) {
    fk_user_id = undefined;
  }

  return new PagedResponseImpl(
    await ApiToken.listWithCreatedBy({ ...param.query, fk_user_id }),
    {
      ...(param.query || {}),
      count: await ApiToken.count({}),
    }
  );
}
