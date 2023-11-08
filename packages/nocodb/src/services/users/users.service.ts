import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { AppEvents, OrgUserRoles, validatePassword } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import isEmail from 'validator/lib/isEmail';
import { T } from 'nc-help';
import * as ejs from 'ejs';
import bcrypt from 'bcryptjs';
import type {
  PasswordChangeReqType,
  PasswordForgotReqType,
  PasswordResetReqType,
  SignUpReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { genJwt, setTokenCookie } from '~/services/users/helpers';
import { NC_APP_SETTINGS } from '~/constants';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { Store, User } from '~/models';
import { randomTokenString } from '~/helpers/stringHelpers';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { NcError } from '~/helpers/catchError';
import { BasesService } from '~/services/bases.service';
import { extractProps } from '~/helpers/extractProps';

@Injectable()
export class UsersService {
  constructor(
    protected metaService: MetaService,
    protected appHooksService: AppHooksService,
    protected basesService: BasesService,
  ) {}

  // allow signup/signin only if email matches against pattern
  validateEmailPattern(email: string) {
    const emailPattern = process.env.NC_AUTH_EMAIL_PATTERN;
    if (emailPattern) {
      const regex = new RegExp(emailPattern);
      if (!regex.test(email)) {
        NcError.forbidden('Not allowed to signup/signin with this email');
      }
    }
  }

  async findOne(_email: string) {
    const email = _email.toLowerCase();
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
    return this.metaService.metaInsert2(null, null, MetaTable.USERS, {
      ...param,
      email: param.email?.toLowerCase(),
    });
  }

  async profileUpdate({
    id,
    params,
  }: {
    id: number;
    params: {
      display_name?: string;
      avatar?: string;
    };
  }) {
    const updateObj = extractProps(params, ['display_name', 'avatar']);

    return await User.update(id, updateObj);
  }

  async registerNewUserIfAllowed({
    email,
    salt,
    password,
    email_verification_token,
    req,
  }: {
    email: string;
    salt: any;
    password;
    email_verification_token;
    req: NcRequest;
  }) {
    this.validateEmailPattern(email);

    let roles: string = OrgUserRoles.CREATOR;

    const isFirstUser = await User.isFirst();

    if (isFirstUser && process.env.NC_CLOUD !== 'true') {
      roles = `${OrgUserRoles.CREATOR},${OrgUserRoles.SUPER_ADMIN}`;
      // todo: update in nc_store
      // roles = 'owner,creator,editor'
      T.emit('evt', {
        evt_type: 'base:invite',
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
    const user = await User.insert({
      email,
      salt,
      password,
      email_verification_token,
      roles,
      token_version,
    });

    // if first user and super admin, create a base
    if (isFirstUser && process.env.NC_CLOUD !== 'true') {
      // todo: update swagger type
      (user as any).createdProject = await this.createDefaultProject(user, req);
    }

    // todo: update swagger type
    return user as any;
  }

  async passwordChange(param: {
    body: PasswordChangeReqType;
    user: UserType;
    req: NcRequest;
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
      token_version: randomTokenString(),
    });

    this.appHooksService.emit(AppEvents.USER_PASSWORD_CHANGE, {
      user: user,
      ip: param.req?.clientIp,
      req: param.req,
    });

    return true;
  }

  async passwordForgot(param: {
    body: PasswordForgotReqType;
    siteUrl: string;
    req: NcRequest;
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
        token_version: randomTokenString(),
      });
      try {
        const template = (
          await import('~/controllers/auth/ui/emailTemplates/forgotPassword')
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
        req: param.req,
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
    req: NcRequest;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/PasswordResetReq',
      param.body,
    );

    const { token, body } = param;

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
      token_version: randomTokenString(),
    });

    this.appHooksService.emit(AppEvents.USER_PASSWORD_RESET, {
      user: user,
      ip: param.req?.clientIp,
      req: param.req,
    });

    return true;
  }

  async emailVerification(param: {
    token: string;
    // todo: exclude
    req: NcRequest;
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
      ip: req?.clientIp,
      req,
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

    const { email: _email, token, ignore_subscribe } = param.req.body;

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

    this.validateEmailPattern(email);

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
    let createdProject = undefined;

    if (user) {
      if (token) {
        await User.update(user.id, {
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
      const { createdProject: _createdProject } =
        await this.registerNewUserIfAllowed({
          email,
          salt,
          password,
          email_verification_token,
          req: param.req,
        });
      createdProject = _createdProject;
    }
    user = await User.getByEmail(email);

    try {
      const template = (
        await import('~/controllers/auth/ui/emailTemplates/verify')
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
      req: param.req,
    });

    this.appHooksService.emit(AppEvents.WELCOME, {
      user,
      req: param.req,
    });

    return { ...(await this.login(user, param.req)), createdProject };
  }

  async login(user: UserType & { provider?: string }, req: any) {
    this.appHooksService.emit(AppEvents.USER_SIGNIN, {
      user,
      req,
    });
    return {
      token: genJwt(user, Noco.getConfig()),
    };
  }

  async signOut(param: { res: any; req: any }) {
    try {
      this.clearCookie(param);
      const user = (param.req as any).user;
      if (user?.id) {
        await User.update(user.id, {
          refresh_token: null,
          token_version: randomTokenString(),
        });
      }
      return { msg: 'Signed out successfully' };
    } catch (e) {
      NcError.badRequest(e.message);
    }
  }

  protected clearCookie(param: { res: any; req: any }) {
    param.res.clearCookie('refresh_token');
  }

  private async createDefaultProject(user: User, req: any) {
    // create new base for user
    const base = await this.basesService.createDefaultBase({
      user,
      req,
    });

    return base;
  }
}
