import { OrgUserRoles } from 'nocodb-sdk';
import { Tele } from 'nc-help';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Router } from 'express';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import ProjectUser from '../../models/ProjectUser';
import validator from 'validator';
import { NcError } from '../helpers/catchError';
import { v4 as uuidv4 } from 'uuid';
import User from '../../models/User';
import Audit from '../../models/Audit';
import NocoCache from '../../cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '../../utils/globals';
import * as ejs from 'ejs';
import NcPluginMgrv2 from '../helpers/NcPluginMgrv2';
import Noco from '../../Noco';
import { PluginCategory } from 'nocodb-sdk';
import { metaApiMetrics } from '../helpers/apiMetrics';
import { randomTokenString } from '../helpers/stringHelpers';

async function userList(req, res) {
  res.json({
    users: new PagedResponseImpl(
      await ProjectUser.getUsersList({
        ...req.query,
        project_id: req.params.projectId,
      }),
      {
        ...req.query,
        count: await ProjectUser.getUsersCount(req.query),
      }
    ),
  });
}

async function userInvite(req, res, next): Promise<any> {
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
      // check if this user has been added to this project
      const projectUser = await ProjectUser.get(req.params.projectId, user.id);
      if (projectUser) {
        NcError.badRequest(
          `${user.email} with role ${projectUser.roles} already exists in this project`
        );
      }

      await ProjectUser.insert({
        project_id: req.params.projectId,
        fk_user_id: user.id,
        roles: req.body.roles || 'editor',
      });

      const cachedUser = await NocoCache.get(
        `${CacheScope.USER}:${email}___${req.params.projectId}`,
        CacheGetType.TYPE_OBJECT
      );

      if (cachedUser) {
        cachedUser.roles = req.body.roles || 'editor';
        await NocoCache.set(
          `${CacheScope.USER}:${email}___${req.params.projectId}`,
          cachedUser
        );
      }

      await Audit.insert({
        project_id: req.params.projectId,
        op_type: 'AUTHENTICATION',
        op_sub_type: 'INVITE',
        user: req.user.email,
        description: `invited ${email} to ${req.params.projectId} project `,
        ip: req.clientIp,
      });
    } else {
      try {
        // create new user with invite token
        const { id } = await User.insert({
          invite_token,
          invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          email,
          roles: OrgUserRoles.VIEWER,
          token_version: randomTokenString(),
        });

        // add user to project
        await ProjectUser.insert({
          project_id: req.params.projectId,
          fk_user_id: id,
          roles: req.body.roles,
        });

        const count = await User.count();
        Tele.emit('evt', { evt_type: 'project:invite', count });

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

// @ts-ignore
async function projectUserUpdate(req, res, next): Promise<any> {
  if (!req?.body?.project_id) {
    return next(new Error('Missing project id in request body.'));
  }

  if (
    req.session?.passport?.user?.roles?.owner &&
    req.session?.passport?.user?.id === req.params.userId &&
    req.body.roles.indexOf('owner') === -1
  ) {
    NcError.badRequest("Super admin can't remove Super role themselves");
  }
  try {
    const user = await User.get(req.params.userId);

    if (!user) {
      NcError.badRequest(`User with id '${req.params.userId}' doesn't exist`);
    }

    // todo: handle roles which contains super
    if (
      !req.session?.passport?.user?.roles?.owner &&
      req.body.roles.indexOf('owner') > -1
    ) {
      NcError.forbidden('Insufficient privilege to add super admin role.');
    }

    await ProjectUser.update(
      req.params.projectId,
      req.params.userId,
      req.body.roles
    );

    await Audit.insert({
      op_type: 'AUTHENTICATION',
      op_sub_type: 'ROLES_MANAGEMENT',
      user: req.user.email,
      description: `updated roles for ${user.email} with ${req.body.roles} `,
      ip: req.clientIp,
    });

    res.json({
      msg: 'User details updated successfully',
    });
  } catch (e) {
    next(e);
  }
}

async function projectUserDelete(req, res): Promise<any> {
  const project_id = req.params.projectId;

  if (req.session?.passport?.user?.id === req.params.userId) {
    NcError.badRequest("Admin can't delete themselves!");
  }

  if (!req.session?.passport?.user?.roles?.owner) {
    const user = await User.get(req.params.userId);
    if (user.roles?.split(',').includes('super'))
      NcError.forbidden('Insufficient privilege to delete a super admin user.');

    const projectUser = await ProjectUser.get(project_id, req.params.userId);
    if (projectUser?.roles?.split(',').includes('super'))
      NcError.forbidden('Insufficient privilege to delete a owner user.');
  }

  await ProjectUser.delete(project_id, req.params.userId);
  res.json({
    msg: 'success',
  });
}

async function projectUserInviteResend(req, res): Promise<any> {
  const user = await User.get(req.params.userId);

  if (!user) {
    NcError.badRequest(`User with id '${req.params.userId}' not found`);
  }

  req.body.roles = user.roles;
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
    op_type: 'AUTHENTICATION',
    op_sub_type: 'RESEND_INVITE',
    user: user.email,
    description: `resent a invite to ${user.email} `,
    ip: req.clientIp,
    project_id: req.params.projectId,
  });

  res.json({ msg: 'success' });
}

export async function sendInviteEmail(
  email: string,
  token: string,
  req: any
): Promise<any> {
  try {
    const template = (await import('./userApi/ui/emailTemplates/invite'))
      .default;

    const emailAdapter = await NcPluginMgrv2.emailAdapter();

    if (emailAdapter) {
      await emailAdapter.mailSend({
        to: email,
        subject: 'Verify email',
        html: ejs.render(template, {
          signupLink: `${req.ncSiteUrl}${
            Noco.getConfig()?.dashboardPath
          }#/signup/${token}`,
          projectName: req.body?.projectName,
          roles: (req.body?.roles || '')
            .split(',')
            .map((r) => r.replace(/^./, (m) => m.toUpperCase()))
            .join(', '),
          adminEmail: req.session?.passport?.user?.email,
        }),
      });
      return true;
    }
  } catch (e) {
    console.log(
      'Warning : `mailSend` failed, Please configure emailClient configuration.',
      e.message
    );
    throw e;
  }
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/projects/:projectId/users',
  metaApiMetrics,
  ncMetaAclMw(userList, 'userList')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/users',
  metaApiMetrics,
  ncMetaAclMw(userInvite, 'userInvite')
);
router.patch(
  '/api/v1/db/meta/projects/:projectId/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(projectUserUpdate, 'projectUserUpdate')
);
router.delete(
  '/api/v1/db/meta/projects/:projectId/users/:userId',
  metaApiMetrics,
  ncMetaAclMw(projectUserDelete, 'projectUserDelete')
);
router.post(
  '/api/v1/db/meta/projects/:projectId/users/:userId/resend-invite',
  metaApiMetrics,
  ncMetaAclMw(projectUserInviteResend, 'projectUserInviteResend')
);
export default router;
