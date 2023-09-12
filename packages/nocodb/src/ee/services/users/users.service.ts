import { promisify } from 'util';
import { UsersService as UsersServiceCE } from 'src/services/users/users.service';
import { Injectable } from '@nestjs/common';
import { AppEvents, OrgUserRoles, validatePassword } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import isEmail from 'validator/lib/isEmail';
import { T } from 'nc-help';
import * as ejs from 'ejs';
import bcrypt from 'bcryptjs';
import { setTokenCookie } from './helpers';
import type { SignUpReqType, UserType } from 'nocodb-sdk';
import { NC_APP_SETTINGS } from '~/constants';
import { validatePayload } from '~/helpers';
import { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ProjectsService } from '~/services/projects.service';
import { Store, User, WorkspaceUser } from '~/models';
import { randomTokenString } from '~/helpers/stringHelpers';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { NcError } from '~/helpers/catchError';
import { WorkspacesService } from '~/modules/workspaces/workspaces.service';

@Injectable()
export class UsersService extends UsersServiceCE {
  constructor(
    protected metaService: MetaService,
    protected appHooksService: AppHooksService,
    protected workspaceService: WorkspacesService,
    protected projectService: ProjectsService,
  ) {
    super(metaService, appHooksService, projectService);
  }
  async registerNewUserIfAllowed({
    avatar,
    display_name,
    user_name,
    email,
    salt,
    password,
    email_verification_token,
  }: {
    avatar;
    display_name;
    user_name;
    email: string;
    salt: any;
    password;
    email_verification_token;
  }) {
    this.validateEmailPattern(email);

    let roles: string = OrgUserRoles.CREATOR;

    let settings: { invite_only_signup?: boolean } = {};
    try {
      settings = JSON.parse((await Store.get(NC_APP_SETTINGS))?.value);
    } catch {}

    if (settings?.invite_only_signup) {
      NcError.badRequest('Not allowed to signup, contact super admin.');
    } else {
      roles = OrgUserRoles.VIEWER;
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
    });

    return user;
  }

  async signup(param: {
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

    let createdWorkspace;

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
      const user = await this.registerNewUserIfAllowed({
        avatar,
        display_name,
        user_name,
        email,
        salt,
        password,
        email_verification_token,
      });

      createdWorkspace = await this.createDefaultWorkspace(user);
    }
    user = await User.getByEmail(email);

    try {
      const template = (
        await import('~/controllers/users/ui/emailTemplates/verify')
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

    this.appHooksService.emit(AppEvents.WELCOME, {
      user,
    });

    return { ...(await this.login(user)), createdWorkspace };
  }

  private async createDefaultWorkspace(user: User) {
    const title = `${user.email?.split('@')?.[0]}`;
    // create new workspace for user
    const workspace = await this.workspaceService.create({
      user,
      workspaces: {
        title,
      },
    });

    return workspace;
  }

  async login(user: UserType) {
    const workspaces = await WorkspaceUser.workspaceList({
      fk_user_id: user.id,
    });

    if (workspaces.length === 0) {
      await this.createDefaultWorkspace(user);
    }

    return await super.login(user);
  }

  protected clearCookie(param: { res: any; req: any }) {
    param.res.clearCookie('refresh_token', {
      httpOnly: true,
      domain: process.env.NC_BASE_HOST_NAME || undefined,
    });
  }
}
