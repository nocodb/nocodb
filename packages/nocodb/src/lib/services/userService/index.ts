import {
  PasswordChangeReqType,
  PasswordForgotReqType,
  PasswordResetReqType,
  UserType,
  validatePassword,
} from 'nocodb-sdk';
import { OrgUserRoles } from 'nocodb-sdk';
import { T } from 'nc-help';

import * as ejs from 'ejs';

import bcrypt from 'bcryptjs';
import { promisify } from 'util';
import { NC_APP_SETTINGS } from '../../constants';
import { NcError } from '../../meta/helpers/catchError';
import NcPluginMgrv2 from '../../meta/helpers/NcPluginMgrv2';
import { Audit, Store, User } from '../../models';
import Noco from '../../Noco';
import { MetaTable } from '../../utils/globals';
import { randomTokenString } from './helpers';

const { v4: uuidv4 } = require('uuid');

export async function registerNewUserIfAllowed({
  firstname,
  lastname,
  email,
  salt,
  password,
  email_verification_token,
}: {
  firstname;
  lastname;
  email: string;
  salt: any;
  password;
  email_verification_token;
}) {
  let roles: string = OrgUserRoles.CREATOR;

  if (await User.isFirst()) {
    roles = `${OrgUserRoles.CREATOR},${OrgUserRoles.SUPER_ADMIN}`;
    // todo: update in nc_store
    // roles = 'owner,creator,editor'
    T.emit('evt', {
      evt_type: 'project:invite',
      count: 1,
    });
  } else {
    let settings: { invite_only_signup?: boolean } = {};
    try {
      settings = JSON.parse((await Store.get(NC_APP_SETTINGS))?.value);
    } catch {}

    if (settings?.invite_only_signup) {
      NcError.badRequest('Not allowed to signup, contact super admin.');
    } else {
      roles = OrgUserRoles.VIEWER;
    }
  }

  const token_version = randomTokenString();

  return await User.insert({
    firstname,
    lastname,
    email,
    salt,
    password,
    email_verification_token,
    roles,
    token_version,
  });
}

export async function passwordChange(param: {
  body: PasswordChangeReqType;
  user: UserType;
  req: any;
}): Promise<any> {
  const { currentPassword, newPassword } = param.body;

  if (!currentPassword || !newPassword) {
    return NcError.badRequest('Missing new/old password');
  }

  // validate password and throw error if password is satisfying the conditions
  const { valid, error } = validatePassword(newPassword);

  if (!valid) {
    NcError.badRequest(`Password : ${error}`);
  }

  const user = await User.getByEmail(param.user.email);

  const hashedPassword = await promisify(bcrypt.hash)(
    currentPassword,
    user.salt
  );

  if (hashedPassword !== user.password) {
    return NcError.badRequest('Current password is wrong');
  }

  const salt = await promisify(bcrypt.genSalt)(10);
  const password = await promisify(bcrypt.hash)(newPassword, salt);

  await User.update(user.id, {
    salt,
    password,
    email: user.email,
    token_version: null,
  });

  await Audit.insert({
    op_type: 'AUTHENTICATION',
    op_sub_type: 'PASSWORD_CHANGE',
    user: user.email,
    description: `changed password `,
    ip: param.req?.clientIp,
  });

  return true;
}

export async function passwordForgot(param: {
  body: PasswordForgotReqType;
  siteUrl: string;
  req: any;
}): Promise<any> {
  const _email = param.body.email;

  if (!_email) {
    NcError.badRequest('Please enter your email address.');
  }

  const email = _email.toLowerCase();
  const user = await User.getByEmail(email);

  if (user) {
    const token = uuidv4();
    await User.update(user.id, {
      email: user.email,
      reset_password_token: token,
      reset_password_expires: new Date(Date.now() + 60 * 60 * 1000),
      token_version: null,
    });
    try {
      const template = (await import('./ui/emailTemplates/forgotPassword'))
        .default;
      await NcPluginMgrv2.emailAdapter().then((adapter) =>
        adapter.mailSend({
          to: user.email,
          subject: 'Password Reset Link',
          text: `Visit following link to update your password : ${param.siteUrl}/auth/password/reset/${token}.`,
          html: ejs.render(template, {
            resetLink: param.siteUrl + `/auth/password/reset/${token}`,
          }),
        })
      );
    } catch (e) {
      console.log(e);
      return NcError.badRequest(
        'Email Plugin is not found. Please contact administrators to configure it in App Store first.'
      );
    }

    await Audit.insert({
      op_type: 'AUTHENTICATION',
      op_sub_type: 'PASSWORD_FORGOT',
      user: user.email,
      description: `requested for password reset `,
      ip: param.req?.clientIp,
    });
  } else {
    return NcError.badRequest('Your email has not been registered.');
  }

  return true;
}

export async function tokenValidate(param: { token: string }): Promise<any> {
  const token = param.token;

  const user = await Noco.ncMeta.metaGet(null, null, MetaTable.USERS, {
    reset_password_token: token,
  });

  if (!user || !user.email) {
    NcError.badRequest('Invalid reset url');
  }
  if (new Date(user.reset_password_expires) < new Date()) {
    NcError.badRequest('Password reset url expired');
  }

  return true;
}

export async function passwordReset(param: {
  body: PasswordResetReqType;
  token: string;
  // todo: exclude
  req: any;
}): Promise<any> {
  const { token, body, req } = param;

  const user = await Noco.ncMeta.metaGet(null, null, MetaTable.USERS, {
    reset_password_token: token,
  });

  if (!user) {
    NcError.badRequest('Invalid reset url');
  }
  if (user.reset_password_expires < new Date()) {
    NcError.badRequest('Password reset url expired');
  }
  if (user.provider && user.provider !== 'local') {
    NcError.badRequest('Email registered via social account');
  }

  // validate password and throw error if password is satisfying the conditions
  const { valid, error } = validatePassword(body.password);
  if (!valid) {
    NcError.badRequest(`Password : ${error}`);
  }

  const salt = await promisify(bcrypt.genSalt)(10);
  const password = await promisify(bcrypt.hash)(body.password, salt);

  await User.update(user.id, {
    salt,
    password,
    email: user.email,
    reset_password_expires: null,
    reset_password_token: '',
    token_version: null,
  });

  await Audit.insert({
    op_type: 'AUTHENTICATION',
    op_sub_type: 'PASSWORD_RESET',
    user: user.email,
    description: `did reset password `,
    ip: req.clientIp,
  });

  return true;
}

export async function emailVerification(param: {
  token: string;
  // todo: exclude
  req: any;
}): Promise<any> {
  const { token, req } = param;

  const user = await Noco.ncMeta.metaGet(null, null, MetaTable.USERS, {
    email_verification_token: token,
  });

  if (!user) {
    NcError.badRequest('Invalid verification url');
  }

  await User.update(user.id, {
    email: user.email,
    email_verification_token: '',
    email_verified: true,
  });

  await Audit.insert({
    op_type: 'AUTHENTICATION',
    op_sub_type: 'EMAIL_VERIFICATION',
    user: user.email,
    description: `verified email `,
    ip: req.clientIp,
  });

  return true;
}

export * from './helpers';
export { default as initAdminFromEnv } from './initAdminFromEnv';
