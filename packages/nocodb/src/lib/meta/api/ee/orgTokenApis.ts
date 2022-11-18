import { OrgUserRoles } from 'nocodb-sdk';
import ApiToken from '../../../models/ApiToken';
import { PagedResponseImpl } from '../../helpers/PagedResponse';

export async function apiTokenListEE(req, res) {
  let fk_user_id = req.user.id;

  // if super admin get all tokens
  if (req.user.roles.includes(OrgUserRoles.SUPER_ADMIN)) {
    fk_user_id = undefined;
  }

  res.json(
    new PagedResponseImpl(
      await ApiToken.listWithCreatedBy({ ...req.query, fk_user_id }),
      {
        ...req.query,
        count: await ApiToken.count({}),
      }
    )
  );
}
