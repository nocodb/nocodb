import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  AuditOperationSubTypes,
  AuditOperationTypes,
  OrgUserRoles,
  validatePassword,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import { isEmail } from 'validator';
import { T } from 'nc-help';
import * as ejs from 'ejs';
import bcrypt from 'bcryptjs';
import { NC_APP_SETTINGS } from '../../constants';
import { validatePayload } from '../../helpers';
import { NcError } from '../../helpers/catchError';
import NcPluginMgrv2 from '../../helpers/NcPluginMgrv2';
import { randomTokenString } from '../../helpers/stringHelpers';
import { MetaService, MetaTable } from '../../meta/meta.service';
import { Audit, Store, User } from '../../models';
import Noco from '../../Noco';
import { AppHooksService } from '../app-hooks/app-hooks.service';
import { genJwt, setTokenCookie } from './helpers';
import type {
  PasswordChangeReqType,
  PasswordForgotReqType,
  PasswordResetReqType,
  SignUpReqType,
  UserType,
} from 'nocodb-sdk';

@Injectable()
export class UsersService {
  constructor(
    private metaService: MetaService,
    private appHooksService: AppHooksService,
  ) {}

  async findOne(email: string) {
    const user = await this.metaService.metaGet(null, null, MetaTable.USERS, {
      email,
    });

    return user;
  }

  async insert(param: {
    token_version: string;
    firstname: any;
    password: any;
    salt: any;
    email_verification_token: any;
    roles: string;
    email: string;
    lastname: any;
  }) {
    return this.metaService.metaInsert2(null, null, MetaTable.USERS, param);
  }

  async registerNewUserIfAllowed({
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

  async passwordChange(param: {
    body: PasswordChangeReqType;
    user: UserType;
    req: any;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/PasswordChangeReq',
      param.body,
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
      user.salt,
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

    this.appHooksService.emit(AppEvents.USER_PASSWORD_CHANGE, {
      user: user,
      ip: param.req?.clientIp,
    });

    return true;
  }

  async passwordForgot(param: {
    body: PasswordForgotReqType;
    siteUrl: string;
    req: any;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/PasswordForgotReq',
      param.body,
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
        const template = (
          await import(
            '../../controllers/users/ui/emailTemplates/forgotPassword'
          )
        ).default;
        await NcPluginMgrv2.emailAdapter().then((adapter) =>
          adapter.mailSend({
            to: user.email,
            subject: 'Password Reset Link',
            text: `Visit following link to update your password : ${param.siteUrl}/auth/password/reset/${token}.`,
            html: ejs.render(template, {
              resetLink: param.siteUrl + `/auth/password/reset/${token}`,
            }),
          }),
        );
      } catch (e) {
        console.log(e);
        return NcError.badRequest(
          'Email Plugin is not found. Please contact administrators to configure it in App Store first.',
        );
      }

      this.appHooksService.emit(AppEvents.USER_PASSWORD_FORGOT, {
        user: user,
        ip: param.req?.clientIp,
      });
    } else {
      return NcError.badRequest('Your email has not been registered.');
    }

    return true;
  }

  async tokenValidate(param: { token: string }): Promise<any> {
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

  async passwordReset(param: {
    body: PasswordResetReqType;
    token: string;
    // todo: exclude
    req: any;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/PasswordResetReq',
      param.body,
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

    this.appHooksService.emit(AppEvents.USER_PASSWORD_RESET, {
      user: user,
      ip: param.req?.clientIp,
    });

    return true;
  }

  async emailVerification(param: {
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

    this.appHooksService.emit(AppEvents.USER_EMAIL_VERIFICATION, {
      user: user,
      ip: param.req?.clientIp,
    });

    return true;
  }

  async refreshToken(param: {
    body: SignUpReqType;
    req: any;
    res: any;
  }): Promise<any> {
    try {
      if (!param.req?.cookies?.refresh_token) {
        NcError.badRequest(`Missing refresh token`);
      }

      const user = await User.getByRefreshToken(
        param.req.cookies.refresh_token,
      );

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

  async signup(param: {
    body: SignUpReqType;
    req: any;
    res: any;
  }): Promise<any> {
    validatePayload('swagger.json#/components/schemas/SignUpReq', param.body);

    const {
      email: _email,
      firstname,
      lastname,
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
            'Expired invite url, Please contact super admin to get a new invite url',
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
      await this.registerNewUserIfAllowed({
        firstname,
        lastname,
        email,
        salt,
        password,
        email_verification_token,
      });
    }
    user = await User.getByEmail(email);

    try {
      const template = (
        await import('../../controllers/users/ui/emailTemplates/verify')
      ).default;
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
        'Warning : `mailSend` failed, Please configure emailClient configuration.',
      );
    }

    const refreshToken = randomTokenString();

    await User.update(user.id, {
      refresh_token: refreshToken,
      email: user.email,
    });

    setTokenCookie(param.res, refreshToken);

    this.appHooksService.emit(AppEvents.USER_SIGNUP, {
      user: user,
      ip: param.req?.clientIp,
    });

    return this.login(user);
  }

  async login(user: any) {
    return {
      token: genJwt(user, Noco.getConfig()), //this.jwtService.sign(payload),
    };
  }

  async signout(param: { res: any; req: any }) {
    try {
      param.res.clearCookie('refresh_token');
      const user = (param.req as any).user;
      if (user) {
        await User.update(user.id, {
          refresh_token: null,
        });
      }
      return { msg: 'Signed out successfully' };
    } catch (e) {
      NcError.badRequest(e.message);
    }
  }
}
