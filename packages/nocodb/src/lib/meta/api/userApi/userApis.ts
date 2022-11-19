import { Request, Response } from 'express';
import { TableType, validatePassword } from 'nocodb-sdk';
import { OrgUserRoles } from 'nocodb-sdk';
import { NC_APP_SETTINGS } from '../../../constants';
import Store from '../../../models/Store';
import { Tele } from 'nc-help';
import catchError, { NcError } from '../../helpers/catchError';

const { isEmail } = require('validator');
import * as ejs from 'ejs';

import bcrypt from 'bcryptjs';
import { promisify } from 'util';
import User from '../../../models/User';

const { v4: uuidv4 } = require('uuid');
import Audit from '../../../models/Audit';
import NcPluginMgrv2 from '../../helpers/NcPluginMgrv2';

import passport from 'passport';
import extractProjectIdAndAuthenticate from '../../helpers/extractProjectIdAndAuthenticate';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import { MetaTable } from '../../../utils/globals';
import Noco from '../../../Noco';
import { genJwt } from './helpers';
import { randomTokenString } from '../../helpers/stringHelpers';

export async function signup(req: Request, res: Response<TableType>) {
  const {
    email: _email,
    firstname,
    lastname,
    token,
    ignore_subscribe,
  } = req.body;
  let { password } = req.body;

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
    Tele.emit('evt_subscribe', email);
  }

  if (user) {
    if (token) {
      await User.update(user.id, {
        firstname,
        lastname,
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
    let roles: string = OrgUserRoles.CREATOR;

    if (await User.isFirst()) {
      roles = `${OrgUserRoles.CREATOR},${OrgUserRoles.SUPER_ADMIN}`;
      // todo: update in nc_store
      // roles = 'owner,creator,editor'
      Tele.emit('evt', {
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

    await User.insert({
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
          (req as any).ncSiteUrl +
          `/email/verify/${user.email_verification_token}`,
      }),
    });
  } catch (e) {
    console.log(
      'Warning : `mailSend` failed, Please configure emailClient configuration.'
    );
  }
  await promisify((req as any).login.bind(req))(user);
  const refreshToken = randomTokenString();
  await User.update(user.id, {
    refresh_token: refreshToken,
    email: user.email,
  });

  setTokenCookie(res, refreshToken);

  user = (req as any).user;

  await Audit.insert({
    op_type: 'AUTHENTICATION',
    op_sub_type: 'SIGNUP',
    user: user.email,
    description: `signed up `,
    ip: (req as any).clientIp,
  });

  res.json({
    token: genJwt(user, Noco.getConfig()),
  } as any);
}

async function successfulSignIn({
  user,
  err,
  info,
  req,
  res,
  auditDescription,
}) {
  try {
    if (!user || !user.email) {
      if (err) {
        return res.status(400).send(err);
      }
      if (info) {
        return res.status(400).send(info);
      }
      return res.status(400).send({ msg: 'Your signin has failed' });
    }

    await promisify((req as any).login.bind(req))(user);
    const refreshToken = randomTokenString();

    if (!user.token_version) {
      user.token_version = randomTokenString();
    }

    await User.update(user.id, {
      refresh_token: refreshToken,
      email: user.email,
      token_version: user.token_version,
    });
    setTokenCookie(res, refreshToken);

    await Audit.insert({
      op_type: 'AUTHENTICATION',
      op_sub_type: 'SIGNIN',
      user: user.email,
      ip: req.clientIp,
      description: auditDescription,
    });

    res.json({
      token: genJwt(user, Noco.getConfig()),
    } as any);
  } catch (e) {
    console.log(e);
    throw e;
  }
}

async function signin(req, res, next) {
  passport.authenticate(
    'local',
    { session: false },
    async (err, user, info): Promise<any> =>
      await successfulSignIn({
        user,
        err,
        info,
        req,
        res,
        auditDescription: 'signed in',
      })
  )(req, res, next);
}

async function googleSignin(req, res, next) {
  passport.authenticate(
    'google',
    {
      session: false,
      callbackURL: req.ncSiteUrl + Noco.getConfig().dashboardPath,
    },
    async (err, user, info): Promise<any> =>
      await successfulSignIn({
        user,
        err,
        info,
        req,
        res,
        auditDescription: 'signed in using Google Auth',
      })
  )(req, res, next);
}

function setTokenCookie(res, token): void {
  // create http only cookie with refresh token that expires in 7 days
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
  res.cookie('refresh_token', token, cookieOptions);
}

async function me(req, res): Promise<any> {
  res.json(req?.session?.passport?.user ?? {});
}

async function passwordChange(req: Request<any, any>, res): Promise<any> {
  if (!(req as any).isAuthenticated()) {
    NcError.forbidden('Not allowed');
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return NcError.badRequest('Missing new/old password');
  }

  // validate password and throw error if password is satisfying the conditions
  const { valid, error } = validatePassword(newPassword);
  if (!valid) {
    NcError.badRequest(`Password : ${error}`);
  }

  const user = await User.getByEmail((req as any).user.email);
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
    ip: (req as any).clientIp,
  });

  res.json({ msg: 'Password updated successfully' });
}

async function passwordForgot(req: Request<any, any>, res): Promise<any> {
  const _email = req.body.email;
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
          text: `Visit following link to update your password : ${
            (req as any).ncSiteUrl
          }/auth/password/reset/${token}.`,
          html: ejs.render(template, {
            resetLink: (req as any).ncSiteUrl + `/auth/password/reset/${token}`,
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
      ip: (req as any).clientIp,
    });
  } else {
    return NcError.badRequest('Your email has not been registered.');
  }
  res.json({ msg: 'Please check your email to reset the password' });
}

async function tokenValidate(req, res): Promise<any> {
  const token = req.params.tokenId;

  const user = await Noco.ncMeta.metaGet(null, null, MetaTable.USERS, {
    reset_password_token: token,
  });

  if (!user || !user.email) {
    NcError.badRequest('Invalid reset url');
  }
  if (new Date(user.reset_password_expires) < new Date()) {
    NcError.badRequest('Password reset url expired');
  }
  res.json(true);
}

async function passwordReset(req, res): Promise<any> {
  const token = req.params.tokenId;

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
  const { valid, error } = validatePassword(req.body.password);
  if (!valid) {
    NcError.badRequest(`Password : ${error}`);
  }

  const salt = await promisify(bcrypt.genSalt)(10);
  const password = await promisify(bcrypt.hash)(req.body.password, salt);

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

  res.json({ msg: 'Password reset successful' });
}

async function emailVerification(req, res): Promise<any> {
  const token = req.params.tokenId;

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

  res.json({ msg: 'Email verified successfully' });
}

async function refreshToken(req, res): Promise<any> {
  try {
    if (!req?.cookies?.refresh_token) {
      return res.status(400).json({ msg: 'Missing refresh token' });
    }

    const user = await User.getByRefreshToken(req.cookies.refresh_token);

    if (!user) {
      return res.status(400).json({ msg: 'Invalid refresh token' });
    }

    const refreshToken = randomTokenString();

    await User.update(user.id, {
      email: user.email,
      refresh_token: refreshToken,
    });

    setTokenCookie(res, refreshToken);

    res.json({
      token: genJwt(user, Noco.getConfig()),
    } as any);
  } catch (e) {
    return res.status(400).json({ msg: e.message });
  }
}

async function renderPasswordReset(req, res): Promise<any> {
  try {
    res.send(
      ejs.render((await import('./ui/auth/resetPassword')).default, {
        token: JSON.stringify(req.params.tokenId),
        baseUrl: `/`,
      })
    );
  } catch (e) {
    return res.status(400).json({ msg: e.message });
  }
}

const mapRoutes = (router) => {
  // todo: old api - /auth/signup?tool=1
  router.post('/auth/user/signup', catchError(signup));
  router.post('/auth/user/signin', catchError(signin));
  router.get('/auth/user/me', extractProjectIdAndAuthenticate, catchError(me));
  router.post('/auth/password/forgot', catchError(passwordForgot));
  router.post('/auth/token/validate/:tokenId', catchError(tokenValidate));
  router.post('/auth/password/reset/:tokenId', catchError(passwordReset));
  router.post('/auth/email/validate/:tokenId', catchError(emailVerification));
  router.post(
    '/user/password/change',
    ncMetaAclMw(passwordChange, 'passwordChange')
  );
  router.post('/auth/token/refresh', ncMetaAclMw(refreshToken, 'refreshToken'));

  /* Google auth apis */

  router.post(`/auth/google/genTokenByCode`, catchError(googleSignin));

  router.get('/auth/google', (req: any, res, next) =>
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: req.query.state,
      callbackURL: req.ncSiteUrl + Noco.getConfig().dashboardPath,
    })(req, res, next)
  );

  // deprecated APIs
  router.post('/api/v1/db/auth/user/signup', catchError(signup));
  router.post('/api/v1/db/auth/user/signin', catchError(signin));
  router.get(
    '/api/v1/db/auth/user/me',
    extractProjectIdAndAuthenticate,
    catchError(me)
  );
  router.post('/api/v1/db/auth/password/forgot', catchError(passwordForgot));
  router.post(
    '/api/v1/db/auth/token/validate/:tokenId',
    catchError(tokenValidate)
  );
  router.post(
    '/api/v1/db/auth/password/reset/:tokenId',
    catchError(passwordReset)
  );
  router.post(
    '/api/v1/db/auth/email/validate/:tokenId',
    catchError(emailVerification)
  );
  router.post(
    '/api/v1/db/auth/password/change',
    ncMetaAclMw(passwordChange, 'passwordChange')
  );
  router.post(
    '/api/v1/db/auth/token/refresh',
    ncMetaAclMw(refreshToken, 'refreshToken')
  );
  router.get(
    '/api/v1/db/auth/password/reset/:tokenId',
    catchError(renderPasswordReset)
  );

  // new API
  router.post('/api/v1/auth/user/signup', catchError(signup));
  router.post('/api/v1/auth/user/signin', catchError(signin));
  router.get(
    '/api/v1/auth/user/me',
    extractProjectIdAndAuthenticate,
    catchError(me)
  );
  router.post('/api/v1/auth/password/forgot', catchError(passwordForgot));
  router.post(
    '/api/v1/auth/token/validate/:tokenId',
    catchError(tokenValidate)
  );
  router.post(
    '/api/v1/auth/password/reset/:tokenId',
    catchError(passwordReset)
  );
  router.post(
    '/api/v1/auth/email/validate/:tokenId',
    catchError(emailVerification)
  );
  router.post(
    '/api/v1/auth/password/change',
    ncMetaAclMw(passwordChange, 'passwordChange')
  );
  router.post(
    '/api/v1/auth/token/refresh',
    ncMetaAclMw(refreshToken, 'refreshToken')
  );
  // respond with password reset page
  router.get('/auth/password/reset/:tokenId', catchError(renderPasswordReset));
};
export { mapRoutes as userApis };
