import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import { OrgUserRoles } from '../../../enums/OrgUserRoles';
import Audit from '../../models/Audit';
import User from '../../models/User';
import { metaApiMetrics } from '../helpers/apiMetrics';
import { NcError } from '../helpers/catchError';
import { extractProps } from '../helpers/extractProps';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { randomTokenString } from '../helpers/stringHelpers';
import { Tele } from 'nc-help';
import { sendInviteEmail } from './projectUserApis';

async function userList(req, res) {
  res.json(
    new PagedResponseImpl(await User.list(req.query), {
      ...req.query,
      count: await User.count(req.query),
    })
  );
}

async function userUpdate(req, res) {
  const updateBody = extractProps(req.body, ['roles']);

  const user = await User.get(req.params.userId);

  if (user.roles.includes(OrgUserRoles.SUPER)) {
    NcError.badRequest('Cannot update super admin roles');
  }

  res.json(await User.update(req.params.userId, updateBody));
}

async function userDelete(req, res) {
  const user = await User.get(req.params.userId);

  if (user.roles.includes(OrgUserRoles.SUPER)) {
    NcError.badRequest('Cannot delete super admin');
  }

  res.json(await User.delete(req.params.userId));
}

async function userAdd(req, res, next) {
  // allow only viewer or creator role
  if (
    req.body.roles &&
    ![OrgUserRoles.VIEWER, OrgUserRoles.CREATOR].includes(req.body.roles)
  ) {
    NcError.badRequest('Invalid role');
  }

  // extract emails from request body
  const emails = (req.body.email || '')
    .toLowerCase()
    .split(/\s*,\s*/)
    .map((v) => v.trim());

  // check for invalid emails
  const invalidEmails = emails.filter((v) => !validator.isEmail(v));

  if (!emails.length) {
    return NcError.badRequest('Invalid email address');
  }
  if (invalidEmails.length) {
    NcError.badRequest('Invalid email address : ' + invalidEmails.join(', '));
  }

  const invite_token = uuidv4();
  const error = [];

  for (const email of emails) {
    // add user to project if user already exist
    const user = await User.getByEmail(email);

    if (user) {
      NcError.badRequest('User already exist');
    } else {
      try {
        // create new user with invite token
        await User.insert({
          invite_token,
          invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          email,
          roles: OrgUserRoles.VIEWER,
          token_version: randomTokenString(),
        });

        const count = await User.count();
        Tele.emit('evt', { evt_type: 'org:user:invite', count });

        await Audit.insert({
          project_id: req.params.projectId,
          op_type: 'AUTHENTICATION',
          op_sub_type: 'INVITE',
          user: req.user.email,
          description: `invited ${email} to ${req.params.projectId} project `,
          ip: req.clientIp,
        });
        // in case of single user check for smtp failure
        // and send back token if failed
        if (
          emails.length === 1 &&
          !(await sendInviteEmail(email, invite_token, req))
        ) {
          return res.json({ invite_token, email });
        } else {
          sendInviteEmail(email, invite_token, req);
        }
      } catch (e) {
        console.log(e);
        if (emails.length === 1) {
          return next(e);
        } else {
          error.push({ email, error: e.message });
        }
      }
    }
  }

  if (emails.length === 1) {
    res.json({
      msg: 'success',
    });
  } else {
    return res.json({ invite_token, emails, error });
  }
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/users',
  metaApiMetrics,
  ncMetaAclMw(userList, 'userList', [OrgUserRoles.SUPER])
);
router.patch(
  '/api/v1/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(userUpdate, 'userUpdate', [OrgUserRoles.SUPER])
);
router.delete(
  '/api/v1/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(userDelete, 'userAdd', [OrgUserRoles.SUPER])
);
router.post(
  '/api/v1/users',
  metaApiMetrics,
  ncMetaAclMw(userAdd, 'userDelete', [OrgUserRoles.SUPER])
);
export default router;
