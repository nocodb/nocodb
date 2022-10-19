import { Router } from 'express';
import { OrgUserRoles } from '../../../enums/OrgUserRoles';
import User from '../../models/User';
import { metaApiMetrics } from '../helpers/apiMetrics';
import { extractProps } from '../helpers/extractProps';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { PagedResponseImpl } from '../helpers/PagedResponse';

async function userList(req, res) {
  res.json(
    new PagedResponseImpl(await User.list(req.query), {
      ...req.query,
      count: await User.count(req.query),
    })
  );
}

async function userUpdate(req, res) {
  const updteBody = extractProps(req.body, ['role']);

  const user = await User.get(req.params.userId);

  if (user.roles.includes(OrgUserRoles.SUPER)) {
    throw new Error('Cannot update super admin roles');
  }

  res.json(await User.update(req.params.userId, updteBody));
}

async function userDelete(req, res) {
  const user = await User.get(req.params.userId);

  if (user.roles.includes(OrgUserRoles.SUPER)) {
    throw new Error('Cannot delete super admin');
  }

  res.json(await User.delete(req.params.userId));
}

async function userAdd(req, res) {

}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/users',
  metaApiMetrics,
  ncMetaAclMw(userList, 'userList', [OrgUserRoles.SUPER])
);
router.patch(
  '/api/v1/db/meta/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(userUpdate, 'userUpdate', [OrgUserRoles.SUPER])
);
router.delete(
  '/api/v1/db/meta/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(userAdd, 'userAdd', [OrgUserRoles.SUPER])
);
router.post(
  '/api/v1/db/meta/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(userDelete, 'userDelete', [OrgUserRoles.SUPER])
);
export default router;
