import { promisify } from 'util';
import { OrgUserRoles } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { v4 as uuidv4 } from 'uuid';
import Noco from '~/Noco';
import { genJwt } from '~/services/users/helpers';
import { UsersService } from '~/services/users/users.service';

export class CreateUserDto {
  readonly username: string;
  readonly email: string;
  readonly password: string;
}

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    if (user) {
      const { password, salt, ...result } = user;

      const hashedPassword = await promisify(bcrypt.hash)(pass, user.salt);
      if (user.password === hashedPassword) {
        return result;
      }
    }
    return null;
  }

  async login(user: any) {
    delete user.password;
    delete user.salt;
    const payload = user;
    return {
      token: genJwt(payload, Noco.getConfig()),
    };
  }

  async signup(createUserDto: CreateUserDto) {
    const {
      email: _email,
      firstname,
      lastname,
      // token,
      // ignore_subscribe,
    } = createUserDto as any;

    let { password } = createUserDto;

    // // validate password and throw error if password is satisfying the conditions
    // const { valid, error } = validatePassword(password);
    // if (!valid) {
    //   NcError.badRequest(`Password : ${error}`);
    // }
    //
    // if (!isEmail(_email)) {
    //   NcError.badRequest(`Invalid email`);
    // }

    const email = _email.toLowerCase();

    let user = await this.usersService.findOne(email);

    if (user) {
      // if (token) {
      //   if (token !== user.invite_token) {
      //     NcError.badRequest(`Invalid invite url`);
      //   } else if (user.invite_token_expires < new Date()) {
      //     NcError.badRequest(
      //       'Expired invite url, Please contact super admin to get a new invite url'
      //     );
      //   }
      // } else {
      //   // todo : opening up signup for timebeing
      //   // return next(new Error(`Email '${email}' already registered`));
      // }
    }

    const salt = await promisify(bcrypt.genSalt)(10);
    password = await promisify(bcrypt.hash)(password, salt);
    const email_verification_token = uuidv4();
    //
    // if (!ignore_subscribe) {
    //   T.emit('evt_subscribe', email);
    // }

    if (user) {
      // if (token) {
      //   await User.update(user.id, {
      //     firstname,
      //     lastname,
      //     salt,
      //     password,
      //     email_verification_token,
      //     invite_token: null,
      //     invite_token_expires: null,
      //     email: user.email,
      //   });
      // } else {
      //   NcError.badRequest('User already exist');
      // }
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
    user = await this.usersService.findOne(email);
    //
    // try {
    //   const template = (await import('./ui/emailTemplates/verify')).default;
    //   await (
    //     await NcPluginMgrv2.emailAdapter()
    //   ).mailSend({
    //     to: email,
    //     subject: 'Verify email',
    //     html: ejs.render(template, {
    //       verifyLink:
    //         (param.req as any).ncSiteUrl +
    //         `/email/verify/${user.email_verification_token}`,
    //     }),
    //   });
    // } catch (e) {
    //   console.log(
    //     'Warning : `mailSend` failed, Please configure emailClient configuration.'
    //   );
    // }
    // await promisify((param.req as any).login.bind(param.req))(user);

    // const refreshToken = ''//randomTokenString();
    //
    // await User.update(user.id, {
    //   refresh_token: refreshToken,
    //   email: user.email,
    // });
    //
    // setTokenCookie(param.res, refreshToken);
    //
    // user = (param.req as any).user;

    return await this.login(user);
  }

  async registerNewUserIfAllowed(
    {
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
    },
    ncMeta = Noco.ncMeta,
  ) {
    const roles: string = OrgUserRoles.CREATOR;

    // if (await User.isFirst()) {
    //   roles = `${OrgUserRoles.CREATOR},${OrgUserRoles.SUPER_ADMIN}`;
    //   // todo: update in nc_store
    //   // roles = 'owner,creator,editor'
    //   T.emit('evt', {
    //     evt_type: 'base:invite',
    //     count: 1,
    //   });
    // } else {
    //   let settings: { invite_only_signup?: boolean } = {};
    //   try {
    //     settings = JSON.parse((await Store.get(NC_APP_SETTINGS))?.value);
    //   } catch {}
    //
    //   if (settings?.invite_only_signup) {
    //     NcError.badRequest('Not allowed to signup, contact super admin.');
    //   } else {
    //     roles = OrgUserRoles.VIEWER;
    //   }
    // }

    const token_version = ''; // randomTokenString();

    return await this.usersService.insert(
      {
        firstname,
        lastname,
        email,
        salt,
        password,
        email_verification_token,
        roles,
        token_version,
      },
      ncMeta,
    );
  }
}
