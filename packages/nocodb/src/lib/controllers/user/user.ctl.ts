import { Request, Response } from 'express';
import * as ejs from 'ejs';
import { promisify } from 'util';

import passport from 'passport';
import catchError, { NcError } from '../../meta/helpers/catchError';
import extractProjectIdAndAuthenticate from '../../meta/helpers/extractProjectIdAndAuthenticate';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import { Audit, User } from '../../models';
import Noco from '../../Noco';
import { userService } from '../../services';

export async function signup(req: Request<any, any>, res): Promise<any> {
  res.json(
    await userService.signup({
      body: req.body,
      req,
      res,
    })
  );
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
  router.post('/api/v1/db/auth/token/refresh', catchError(refreshToken));
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
  router.post('/api/v1/auth/token/refresh', catchError(refreshToken));
  // respond with password reset page
  router.get('/auth/password/reset/:tokenId', catchError(renderPasswordReset));
};
export default mapRoutes;
