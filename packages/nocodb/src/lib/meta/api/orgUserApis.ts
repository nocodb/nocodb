import { Router } from 'express';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  PluginCategory,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import { OrgUserRoles } from 'nocodb-sdk';
import { NC_APP_SETTINGS } from '../../constants';
import Audit from '../../models/Audit';
import ProjectUser from '../../models/ProjectUser';
import Store from '../../models/Store';
import SyncSource from '../../models/SyncSource';
import User from '../../models/User';
import Noco from '../../Noco';
import { MetaTable } from '../../utils/globals';
import { Tele } from 'nc-help';
import { metaApiMetrics } from '../helpers/apiMetrics';
import { NcError } from '../helpers/catchError';
import { extractProps } from '../helpers/extractProps';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { randomTokenString } from '../helpers/stringHelpers';
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

  if (user.roles.includes(OrgUserRoles.SUPER_ADMIN)) {
    NcError.badRequest('Cannot update super admin roles');
  }

  res.json(
    await User.update(req.params.userId, {
      ...updateBody,
      token_version: null,
    })
  );
}

async function userDelete(req, res) {
  const ncMeta = await Noco.ncMeta.startTransaction();
  try {
    const user = await User.get(req.params.userId, ncMeta);

    if (user.roles.includes(OrgUserRoles.SUPER_ADMIN)) {
      NcError.badRequest('Cannot delete super admin');
    }

    // delete project user entry and assign to super admin
    const projectUsers = await ProjectUser.getProjectsIdList(
      req.params.userId,
      ncMeta
    );

    // todo: clear cache

    // TODO: assign super admin as project owner
    for (const projectUser of projectUsers) {
      await ProjectUser.delete(
        projectUser.project_id,
        projectUser.fk_user_id,
        ncMeta
      );
    }

    // delete sync source entry
    await SyncSource.deleteByUserId(req.params.userId, ncMeta);

    // delete user
    await User.delete(req.params.userId, ncMeta);
    await ncMeta.commit();
  } catch (e) {
    await ncMeta.rollback(e);
    throw e;
  }

  res.json({ msg: 'success' });
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
          roles: req.body.roles || OrgUserRoles.VIEWER,
          token_version: randomTokenString(),
        });

        const count = await User.count();
        Tele.emit('evt', { evt_type: 'org:user:invite', count });

        await Audit.insert({
          op_type: AuditOperationTypes.ORG_USER,
          op_sub_type: AuditOperationSubTypes.INVITE,
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

async function userSettings(_req, _res): Promise<any> {
  NcError.notImplemented();
}

async function userInviteResend(req, res): Promise<any> {
  const user = await User.get(req.params.userId);

  if (!user) {
    NcError.badRequest(`User with id '${req.params.userId}' not found`);
  }

  const invite_token = uuidv4();

  await User.update(user.id, {
    invite_token,
    invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const pluginData = await Noco.ncMeta.metaGet2(null, null, MetaTable.PLUGIN, {
    category: PluginCategory.EMAIL,
    active: true,
  });

  if (!pluginData) {
    NcError.badRequest(
      `No Email Plugin is found. Please go to App Store to configure first or copy the invitation URL to users instead.`
    );
  }

  await sendInviteEmail(user.email, invite_token, req);

  await Audit.insert({
    op_type: AuditOperationTypes.ORG_USER,
    op_sub_type: AuditOperationSubTypes.RESEND_INVITE,
    user: user.email,
    description: `resent a invite to ${user.email} `,
    ip: req.clientIp,
  });

  res.json({ msg: 'success' });
}

async function generateResetUrl(req, res) {
  const user = await User.get(req.params.userId);

  if (!user) {
    NcError.badRequest(`User with id '${req.params.userId}' not found`);
  }
  const token = uuidv4();
  await User.update(user.id, {
    email: user.email,
    reset_password_token: token,
    reset_password_expires: new Date(Date.now() + 60 * 60 * 1000),
    token_version: null,
  });

  res.json({
    reset_password_token: token,
    reset_password_url: req.ncSiteUrl + `/auth/password/reset/${token}`,
  });
}

async function appSettingsGet(_req, res) {
  let settings = {};
  try {
    settings = JSON.parse((await Store.get(NC_APP_SETTINGS))?.value);
  } catch {}
  res.json(settings);
}

async function appSettingsSet(req, res) {
  await Store.saveOrUpdate({
    value: JSON.stringify(req.body),
    key: NC_APP_SETTINGS,
  });

  res.json({ msg: 'Settings saved' });
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/users',
  metaApiMetrics,
  ncMetaAclMw(userList, 'userList', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.patch(
  '/api/v1/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(userUpdate, 'userUpdate', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.delete(
  '/api/v1/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(userDelete, 'userDelete', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.post(
  '/api/v1/users',
  metaApiMetrics,
  ncMetaAclMw(userAdd, 'userAdd', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.post(
  '/api/v1/users/settings',
  metaApiMetrics,
  ncMetaAclMw(userSettings, 'userSettings', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);
router.post(
  '/api/v1/users/:userId/resend-invite',
  metaApiMetrics,
  ncMetaAclMw(userInviteResend, 'userInviteResend', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);

router.post(
  '/api/v1/users/:userId/generate-reset-url',
  metaApiMetrics,
  ncMetaAclMw(generateResetUrl, 'generateResetUrl', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);

router.get(
  '/api/v1/app-settings',
  metaApiMetrics,
  ncMetaAclMw(appSettingsGet, 'appSettingsGet', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);

router.post(
  '/api/v1/app-settings',
  metaApiMetrics,
  ncMetaAclMw(appSettingsSet, 'appSettingsSet', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
);

export default router;
