import { Request, Response } from 'express';
import { TableType, validatePassword } from 'nocodb-sdk';
import { T } from 'nc-help';

const { isEmail } = require('validator');
import * as ejs from 'ejs';

import bcrypt from 'bcryptjs';
import { promisify } from 'util';

const { v4: uuidv4 } = require('uuid');

import passport from 'passport';
import { getAjvValidatorMw } from '../../meta/api/helpers';
import catchError, { NcError } from '../../meta/helpers/catchError';
import extractProjectIdAndAuthenticate from '../../meta/helpers/extractProjectIdAndAuthenticate';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import NcPluginMgrv2 from '../../meta/helpers/NcPluginMgrv2';
import { Audit, User } from '../../models';
import Noco from '../../Noco';
import { userService } from '../../services';

export async function signup(req: Request, res: Response<TableType>) {
  const {
    email: _email,
    avatar,
    user_name,
    display_name,
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
    T.emit('evt_subscribe', email);
  }

  if (user) {
    if (token) {
      await User.update(user.id, {
        avatar,
        user_name,
        display_name,
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
    await userService.registerNewUserIfAllowed({
      avatar,
      user_name,
      display_name,
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
  const refreshToken = userService.randomTokenString();
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
    token: userService.genJwt(user, Noco.getConfig()),
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
    const refreshToken = userService.randomTokenString();

    if (!user.token_version) {
      user.token_version = userService.randomTokenString();
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
      token: userService.genJwt(user, Noco.getConfig()),
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

function setTokenCookie(res: Response, token): void {
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

  await userService.passwordChange({
    user: req['user'],
    req,
    body: req.body,
  });

  res.json({ msg: 'Password updated successfully' });
}

async function passwordForgot(req: Request<any, any>, res): Promise<any> {
  await userService.passwordForgot({
    siteUrl: (req as any).ncSiteUrl,
    body: req.body,
    req,
  });

  res.json({ msg: 'Please check your email to reset the password' });
}

async function tokenValidate(req, res): Promise<any> {
  await userService.tokenValidate({
    token: req.params.tokenId,
  });
  res.json(true);
}

async function passwordReset(req, res): Promise<any> {
  await userService.passwordReset({
    token: req.params.tokenId,
    body: req.body,
    req,
  });

  res.json({ msg: 'Password reset successful' });
}

async function emailVerification(req, res): Promise<any> {
  await userService.emailVerification({
    token: req.params.tokenId,
    req,
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

    const refreshToken = userService.randomTokenString();

    await User.update(user.id, {
      email: user.email,
      refresh_token: refreshToken,
    });

    setTokenCookie(res, refreshToken);

    res.json({
      token: userService.genJwt(user, Noco.getConfig()),
    } as any);
  } catch (e) {
    return res.status(400).json({ msg: e.message });
  }
}

async function renderPasswordReset(req, res): Promise<any> {
  try {
    res.send(
      ejs.render((await import('./ui/auth/resetPassword')).default, {
        ncPublicUrl: process.env.NC_PUBLIC_URL || '',
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
  router.post(
    '/auth/user/signup',
    getAjvValidatorMw('swagger.json#/components/schemas/SignUpReq'),
    catchError(signup)
  );
  router.post(
    '/auth/user/signin',
    getAjvValidatorMw('swagger.json#/components/schemas/SignInReq'),
    catchError(signin)
  );
  router.get('/auth/user/me', extractProjectIdAndAuthenticate, catchError(me));
  router.post('/auth/password/forgot', catchError(passwordForgot));
  router.post('/auth/token/validate/:tokenId', catchError(tokenValidate));
  router.post(
    '/auth/password/reset/:tokenId',
    getAjvValidatorMw('swagger.json#/components/schemas/PasswordResetReq'),
    catchError(passwordReset)
  );
  router.post('/auth/email/validate/:tokenId', catchError(emailVerification));
  router.post(
    '/user/password/change',
    ncMetaAclMw(passwordChange, 'passwordChange')
  );
  router.post('/auth/token/refresh', catchError(refreshToken));

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
  router.post(
    '/api/v1/db/auth/user/signup',
    getAjvValidatorMw('swagger.json#/components/schemas/SignUpReq'),
    catchError(signup)
  );
  router.post(
    '/api/v1/db/auth/user/signin',
    getAjvValidatorMw('swagger.json#/components/schemas/SignInReq'),
    catchError(signin)
  );
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
  router.post('/api/v1/db/auth/token/refresh', catchError(refreshToken));
  router.get(
    '/api/v1/db/auth/password/reset/:tokenId',
    catchError(renderPasswordReset)
  );

  // new API
  router.post(
    '/api/v1/auth/user/signup',
    getAjvValidatorMw('swagger.json#/components/schemas/SignUpReq'),
    catchError(signup)
  );
  router.post(
    '/api/v1/auth/user/signin',
    getAjvValidatorMw('swagger.json#/components/schemas/SignInReq'),
    catchError(signin)
  );
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
  router.post('/api/v1/auth/token/refresh', catchError(refreshToken));
  // respond with password reset page
  router.get('/auth/password/reset/:tokenId', catchError(renderPasswordReset));
};
export { mapRoutes as userController };
