import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  PluginCategory,
  UserType,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import { OrgUserRoles } from 'nocodb-sdk';
import { NC_APP_SETTINGS } from '../constants';
import { validatePayload } from '../meta/api/helpers';
import { Audit, ProjectUser, Store, SyncSource, User } from '../models';
import Noco from '../Noco';
import { MetaTable } from '../utils/globals';
import { T } from 'nc-help';
import { NcError } from '../meta/helpers/catchError';
import { extractProps } from '../meta/helpers/extractProps';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import { randomTokenString } from '../meta/helpers/stringHelpers';
import { sendInviteEmail } from './projectUser.svs';

export async function userList(param: {
  // todo: add better typing
  query: Record<string, any>;
}) {
  const { query = {} } = param;

  return new PagedResponseImpl(await User.list(query), {
    ...query,
    count: await User.count(query),
  });
}

export async function userUpdate(param: {
  // todo: better typing
  user: Partial<UserType>;
  userId: string;
}) {
  validatePayload('swagger.json#/components/schemas/OrgUserReq', param.user);

  const updateBody = extractProps(param.user, ['roles']);

  const user = await User.get(param.userId);

  if (user.roles.includes(OrgUserRoles.SUPER_ADMIN)) {
    NcError.badRequest('Cannot update super admin roles');
  }

  return await User.update(param.userId, {
    ...updateBody,
    token_version: null,
  });
}

export async function userDelete(param: { userId: string }) {
  const ncMeta = await Noco.ncMeta.startTransaction();
  try {
    const user = await User.get(param.userId, ncMeta);

    if (user.roles.includes(OrgUserRoles.SUPER_ADMIN)) {
      NcError.badRequest('Cannot delete super admin');
    }

    // delete project user entry and assign to super admin
    const projectUsers = await ProjectUser.getProjectsIdList(
      param.userId,
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
    await SyncSource.deleteByUserId(param.userId, ncMeta);

    // delete user
    await User.delete(param.userId, ncMeta);
    await ncMeta.commit();
  } catch (e) {
    await ncMeta.rollback(e);
    throw e;
  }

  return true;
}

export async function userAdd(param: {
  user: UserType;
  projectId: string;
  // todo: refactor
  req: any;
}) {
  validatePayload('swagger.json#/components/schemas/OrgUserReq', param.user);

  // allow only viewer or creator role
  if (
    param.user.roles &&
    ![OrgUserRoles.VIEWER, OrgUserRoles.CREATOR].includes(
      param.user.roles as OrgUserRoles
    )
  ) {
    NcError.badRequest('Invalid role');
  }

  // extract emails from request body
  const emails = (param.user.email || '')
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
          roles: param.user.roles || OrgUserRoles.VIEWER,
          token_version: randomTokenString(),
        });

        const count = await User.count();
        T.emit('evt', { evt_type: 'org:user:invite', count });

        await Audit.insert({
          op_type: AuditOperationTypes.ORG_USER,
          op_sub_type: AuditOperationSubTypes.INVITE,
          user: param.req.user.email,
          description: `invited ${email} to ${param.projectId} project `,
          ip: param.req.clientIp,
        });
        // in case of single user check for smtp failure
        // and send back token if failed
        if (
          emails.length === 1 &&
          !(await sendInviteEmail(email, invite_token, param.req))
        ) {
          return { invite_token, email };
        } else {
          sendInviteEmail(email, invite_token, param.req);
        }
      } catch (e) {
        console.log(e);
        if (emails.length === 1) {
          throw e;
        } else {
          error.push({ email, error: e.message });
        }
      }
    }
  }

  if (emails.length === 1) {
    return {
      msg: 'success',
    };
  } else {
    return { invite_token, emails, error };
  }
}

export async function userSettings(_param): Promise<any> {
  NcError.notImplemented();
}

export async function userInviteResend(param: {
  userId: string;
  req: any;
}): Promise<any> {
  const user = await User.get(param.userId);

  if (!user) {
    NcError.badRequest(`User with id '${param.userId}' not found`);
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

  await sendInviteEmail(user.email, invite_token, param.req);

  await Audit.insert({
    op_type: AuditOperationTypes.ORG_USER,
    op_sub_type: AuditOperationSubTypes.RESEND_INVITE,
    user: user.email,
    description: `resent a invite to ${user.email} `,
    ip: param.req.clientIp,
  });

  return true;
}

export async function generateResetUrl(param: {
  userId: string;
  siteUrl: string;
}) {
  const user = await User.get(param.userId);

  if (!user) {
    NcError.badRequest(`User with id '${param.userId}' not found`);
  }
  const token = uuidv4();
  await User.update(user.id, {
    email: user.email,
    reset_password_token: token,
    reset_password_expires: new Date(Date.now() + 60 * 60 * 1000),
    token_version: null,
  });

  return {
    reset_password_token: token,
    reset_password_url: param.siteUrl + `/auth/password/reset/${token}`,
  };
}

export async function appSettingsGet() {
  let settings = {};
  try {
    settings = JSON.parse((await Store.get(NC_APP_SETTINGS))?.value);
  } catch {}
  return settings;
}

export async function appSettingsSet(param: { settings: any }) {
  await Store.saveOrUpdate({
    value: JSON.stringify(param.settings),
    key: NC_APP_SETTINGS,
  });
  return true;
}
