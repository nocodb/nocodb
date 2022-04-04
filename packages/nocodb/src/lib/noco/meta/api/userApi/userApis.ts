import { Request, Response } from 'express';
import { TableType } from 'nocodb-sdk';
import catchError, { NcError } from '../../helpers/catchError';
const { isEmail } = require('validator');
import * as ejs from 'ejs';

import bcrypt from 'bcryptjs';
import { promisify } from 'util';
import User from '../../../../noco-models/User';
import { Tele } from 'nc-help';

const { v4: uuidv4 } = require('uuid');
import * as jwt from 'jsonwebtoken';
import Audit from '../../../../noco-models/Audit';
import crypto from 'crypto';
import NcPluginMgrv2 from '../../helpers/NcPluginMgrv2';

// todo: read from database
const secret = 'dkjfkdjfkjdfjdfjdkfjdkfjkdfkjdkfjdkjfkdk';
const jwtConfig = {};

import passport from 'passport';
import extractProjectIdAndAuthenticate from '../../helpers/extractProjectIdAndAuthenticate';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import { MetaTable } from '../../../../utils/globals';
import Noco from '../../../Noco';

export async function signup(req: Request, res: Response<TableType>) {
  const {
    email: _email,
    firstname,
    lastname,
    token,
    ignore_subscribe
  } = req.body;
  let { password } = req.body;

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
        invite_token_expires: null
      });
    } else {
      NcError.badRequest('User already exist');
    }
  } else {
    let roles = 'user';

    if (await User.isFirst()) {
      roles = 'user,super';
      // todo: update in nc_store
      // roles = 'owner,creator,editor'
      Tele.emit('evt', {
        evt_type: 'project:invite',
        count: 1
      });
    } else {
      if (process.env.NC_INVITE_ONLY_SIGNUP) {
        NcError.badRequest('Not allowed to signup, contact super admin.');
      } else {
        roles = 'user_new';
      }
    }

    await User.insert({
      firstname,
      lastname,
      email,
      salt,
      password,
      email_verification_token,
      roles
    });
  }
  user = await User.getByEmail(email);

  try {
    const template = (await import('./ui/emailTemplates/verify')).default;
    await (await NcPluginMgrv2.emailAdapter()).mailSend({
      to: email,
      subject: 'Verify email',
      html: ejs.render(template, {
        verifyLink:
          (req as any).ncSiteUrl +
          `/email/verify/${user.email_verification_token}`
      })
    });
  } catch (e) {
    console.log(
      'Warning : `mailSend` failed, Please configure emailClient configuration.'
    );
  }
  await promisify((req as any).login.bind(req))(user);
  const refreshToken = randomTokenString();
  await User.update(user.id, {
    refresh_token: refreshToken
  });

  setTokenCookie(res, refreshToken);

  user = (req as any).user;

  Audit.insert({
    op_type: 'AUTHENTICATION',
    op_sub_type: 'SIGNUP',
    user: user.email,
    description: `signed up `,
    ip: (req as any).clientIp
  });

  res.json({
    token: jwt.sign(
      {
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        id: user.id,
        roles: user.roles
      },
      secret
    )
  } as any);
}

async function signin(req, res, next) {
  passport.authenticate(
    'local',
    { session: false },
    async (err, user, info): Promise<any> => {
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

        await User.update(user.id, {
          refresh_token: refreshToken
        });
        setTokenCookie(res, refreshToken);

        Audit.insert({
          op_type: 'AUTHENTICATION',
          op_sub_type: 'SIGNIN',
          user: user.email,
          ip: req.clientIp,
          description: `signed in`
        });

        res.json({
          token: jwt.sign(
            {
              email: user.email,
              firstname: user.firstname,
              lastname: user.lastname,
              id: user.id,
              roles: user.roles
            },
            secret,
            jwtConfig
          )
        } as any);
      } catch (e) {
        console.log(e);
        throw e;
      }
    }
  )(req, res, next);
}

function randomTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}
function setTokenCookie(res, token): void {
  // create http only cookie with refresh token that expires in 7 days
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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
    password
  });

  Audit.insert({
    op_type: 'AUTHENTICATION',
    op_sub_type: 'PASSWORD_CHANGE',
    user: user.email,
    description: `changed password `,
    ip: (req as any).clientIp
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
      reset_password_token: token,
      reset_password_expires: new Date(Date.now() + 60 * 60 * 1000)
    });
    try {
      const template = (await import('./ui/emailTemplates/forgotPassword'))
        .default;
      await NcPluginMgrv2.emailAdapter().then(adapter =>
        adapter.mailSend({
          to: user.email,
          subject: 'Password Reset Link',
          text: `Visit following link to update your password : ${
            (req as any).ncSiteUrl
          }/password/reset/${token}.`,
          html: ejs.render(template, {
            resetLink: (req as any).ncSiteUrl + `/password/reset/${token}`
          })
        })
      );
    } catch (e) {
      console.log(
        'Warning : `mailSend` failed, Please configure emailClient configuration.'
      );
    }
    console.log(`Password reset token : ${token}`);

    Audit.insert({
      op_type: 'AUTHENTICATION',
      op_sub_type: 'PASSWORD_FORGOT',
      user: user.email,
      description: `requested for password reset `,
      ip: (req as any).clientIp
    });
  }
  res.json({ msg: 'Check your email if you are registered with us.' });
}

async function tokenValidate(req, res): Promise<any> {
  const token = req.params.token;

  const user = await Noco.ncMeta.metaGet(null, null, MetaTable.USERS, {
    reset_password_token: token
  });

  if (!user || !user.email) {
    NcError.badRequest('Invalid reset url');
  }
  if (user.reset_password_expires < new Date()) {
    NcError.badRequest('Password reset url expired');
  }
  res.json(true);
}

async function passwordReset(req, res): Promise<any> {
  const token = req.params.token;

  const user = await Noco.ncMeta.metaGet(null, null, MetaTable.USERS, {
    reset_password_token: token
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

  const salt = await promisify(bcrypt.genSalt)(10);
  const password = await promisify(bcrypt.hash)(req.body.password, salt);

  await User.update(user.id, {
    salt,
    password,
    reset_password_expires: null,
    reset_password_token: ''
  });

  Audit.insert({
    op_type: 'AUTHENTICATION',
    op_sub_type: 'PASSWORD_RESET',
    user: user.email,
    description: `did reset password `,
    ip: req.clientIp
  });

  res.json({ msg: 'Password reset successful' });
}

async function emailVerification(req, res): Promise<any> {
  const token = req.params.token;

  const user = await Noco.ncMeta.metaGet(null, null, MetaTable.USERS, {
    email_verification_token: token
  });

  if (!user) {
    NcError.badRequest('Invalid verification url');
  }

  await User.update(user.id, {
    email_verification_token: '',
    email_verified: true
  });

  Audit.insert({
    op_type: 'AUTHENTICATION',
    op_sub_type: 'EMAIL_VERIFICATION',
    user: user.email,
    description: `verified email `,
    ip: req.clientIp
  });

  res.json({ msg: 'Email verified successfully' });
}

const mapRoutes = router => {
  // todo: old api - /auth/signup?tool=1
  router.post('/auth/user/signup', catchError(signup));
  router.post('/auth/user/signin', catchError(signin));
  router.get('/auth/user/me', extractProjectIdAndAuthenticate, catchError(me));
  router.post('/auth/password/forgot', catchError(passwordForgot));
  router.post('/auth/token/validate/:tokenId', catchError(tokenValidate));
  router.post('/auth/password/reset/:tokenId', catchError(passwordReset));
  router.post('/auth/email/validate/:tokenId', catchError(emailVerification));

  router.post('/user/password/change', ncMetaAclMw(passwordChange));
};
export { mapRoutes as userApis };
