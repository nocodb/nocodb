import { promisify } from 'util';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  OrgUserRoles,
  validatePassword,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { T } from 'nc-help';
import * as ejs from 'ejs';
import bcrypt from 'bcryptjs';
import { NC_APP_SETTINGS } from '../../constants';
import { validatePayload } from '../../meta/api/helpers';
import { NcError } from '../../meta/helpers/catchError';
import NcPluginMgrv2 from '../../meta/helpers/NcPluginMgrv2';
import { Audit, Store, User, Workspace, WorkspaceUser } from '../../models';
import Noco from '../../Noco';
import { MetaTable } from '../../utils/globals';
import { genJwt, randomTokenString, setTokenCookie } from './helpers';
import type {
  PasswordChangeReqType,
  PasswordForgotReqType,
  PasswordResetReqType,
  SignUpReqType,
  UserType,
} from 'nocodb-sdk';

const { v4: uuidv4 } = require('uuid');
const { isEmail } = require('validator');

export async function registerNewUserIfAllowed({
  avatar,
  user_name,
  display_name,
  email,
  salt,
  password,
  email_verification_token,
  email_verified,
}: {
  avatar;
  user_name;
  display_name;
  email: string;
  salt: any;
  password;
  email_verification_token;
  email_verified?;
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
      // roles = OrgUserRoles.VIEWER;
      // todo: handle in self-hosted
    }
  }

  const token_version = randomTokenString();

  const user = await User.insert({
    avatar,
    display_name,
    user_name,
    email,
    salt,
    password,
    email_verification_token,
    roles,
    token_version,
    email_verified,
  });

  await createDefaultWorkspace(user);
  return user;
}

export async function createDefaultWorkspace(user: User) {
  const title = `${user.email?.split('@')?.[0]}`;
  // create new workspace for user
  const workspace = await Workspace.insert({
    title,
    description: 'Default workspace',
    fk_user_id: user.id,
  });

  await WorkspaceUser.insert({
    fk_user_id: user.id,
    fk_workspace_id: workspace.id,
    roles: WorkspaceUserRoles.OWNER,
  });

  return workspace;
}

export async function passwordChange(param: {
  body: PasswordChangeReqType;
  user: UserType;
  req: any;
}): Promise<any> {
  validatePayload(
    'swagger.json#/components/schemas/PasswordChangeReq',
    param.body
  );

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
    op_type: AuditOperationTypes.AUTHENTICATION,
    op_sub_type: AuditOperationSubTypes.PASSWORD_CHANGE,
    user: user.email,
    description: `Password has been changed`,
    ip: param.req?.clientIp,
  });

  return true;
}

export async function passwordForgot(param: {
  body: PasswordForgotReqType;
  siteUrl: string;
  req: any;
}): Promise<any> {
  validatePayload(
    'swagger.json#/components/schemas/PasswordForgotReq',
    param.body
  );

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
      op_type: AuditOperationTypes.AUTHENTICATION,
      op_sub_type: AuditOperationSubTypes.PASSWORD_FORGOT,
      user: user.email,
      description: `Password Reset has been requested`,
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
  validatePayload(
    'swagger.json#/components/schemas/PasswordResetReq',
    param.body
  );

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
    op_type: AuditOperationTypes.AUTHENTICATION,
    op_sub_type: AuditOperationSubTypes.PASSWORD_RESET,
    user: user.email,
    description: `Password has been reset`,
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
    op_type: AuditOperationTypes.AUTHENTICATION,
    op_sub_type: AuditOperationSubTypes.EMAIL_VERIFICATION,
    user: user.email,
    description: `Email has been verified`,
    ip: req.clientIp,
  });

  return true;
}

export async function refreshToken(param: {
  body: SignUpReqType;
  req: any;
  res: any;
}): Promise<any> {
  try {
    if (!param.req?.cookies?.refresh_token) {
      NcError.badRequest(`Missing refresh token`);
    }

    const user = await User.getByRefreshToken(param.req.cookies.refresh_token);

    if (!user) {
      NcError.badRequest(`Invalid refresh token`);
    }

    const refreshToken = randomTokenString();

    await User.update(user.id, {
      email: user.email,
      refresh_token: refreshToken,
    });

    setTokenCookie(param.res, refreshToken);

    return {
      token: genJwt(user, Noco.getConfig()),
    } as any;
  } catch (e) {
    NcError.badRequest(e.message);
  }
}

export async function signup(param: {
  body: SignUpReqType;
  req: any;
  res: any;
}): Promise<any> {
  validatePayload('swagger.json#/components/schemas/SignUpReq', param.body);

  const {
    email: _email,
    avatar,
    display_name,
    user_name,
    token,
    ignore_subscribe,
  } = param.req.body;

  let { password } = param.req.body;

  // validate password and throw error if password is satisfying the conditions
  const { valid, error } = validatePassword(password);
  if (!valid) {
    NcError.badRequest(`Password : ${error}`);
  }

  if (!isEmail(_email)) {
    NcError.badRequest(`Invalid email`);
  }

  const email = _email.toLowerCase();

  let user = await User.getByEmail(email);

  if (user) {
    if (token) {
      if (token !== user.invite_token) {
        NcError.badRequest(`Invalid invite url`);
      } else if (user.invite_token_expires < new Date()) {
        NcError.badRequest(
          'Expired invite url, Please contact super admin to get a new invite url'
        );
      }
    } else {
      // todo : opening up signup for timebeing
      // return next(new Error(`Email '${email}' already registered`));
    }
  }

  const salt = await promisify(bcrypt.genSalt)(10);
  password = await promisify(bcrypt.hash)(password, salt);
  const email_verification_token = uuidv4();

  if (!ignore_subscribe) {
    T.emit('evt_subscribe', email);
  }

  if (user) {
    if (token) {
      await User.update(user.id, {
        avatar,
        display_name,
        user_name,
        salt,
        password,
        email_verification_token,
        invite_token: null,
        invite_token_expires: null,
        email: user.email,
      });
    } else {
      NcError.badRequest('User already exist');
    }
  } else {
    await registerNewUserIfAllowed({
      avatar,
      display_name,
      user_name,
      email,
      salt,
      password,
      email_verification_token,
    });
  }
  user = await User.getByEmail(email);

  try {
    const template = (await import('./ui/emailTemplates/verify')).default;
    await (
      await NcPluginMgrv2.emailAdapter()
    ).mailSend({
      to: email,
      subject: 'Verify email',
      html: ejs.render(template, {
        verifyLink:
          (param.req as any).ncSiteUrl +
          `/email/verify/${user.email_verification_token}`,
      }),
    });
  } catch (e) {
    console.log(
      'Warning : `mailSend` failed, Please configure emailClient configuration.'
    );
  }
  await promisify((param.req as any).login.bind(param.req))(user);

  const refreshToken = randomTokenString();

  await User.update(user.id, {
    refresh_token: refreshToken,
    email: user.email,
  });

  setTokenCookie(param.res, refreshToken);

  user = (param.req as any).user;

  await Audit.insert({
    op_type: AuditOperationTypes.AUTHENTICATION,
    op_sub_type: AuditOperationSubTypes.SIGNUP,
    user: user.email,
    description: `User has signed up`,
    ip: (param.req as any).clientIp,
  });

  return {
    token: genJwt(user, Noco.getConfig()),
  } as any;
}

export * from './helpers';
export { default as initAdminFromEnv } from './initAdminFromEnv';
