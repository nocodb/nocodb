import { validatePassword } from 'nocodb-sdk';
import { promisify } from 'util';
import { NcError } from '../../meta/helpers/catchError';
import User from '../../models/User';
const { isEmail } = require('validator');
import bcrypt from 'bcryptjs';
const { v4: uuidv4 } = require('uuid');
import { Tele } from 'nc-help';
import { randomTokenString } from '../../meta/helpers/stringHelpers';
import { genJwt } from '../../meta/api/userApi/helpers';
import Audit from '../../models/Audit';
import NcPluginMgrv2 from '../../meta/helpers/NcPluginMgrv2';
import * as ejs from 'ejs';
import { NcConfig } from '../../../interface/config';

export default class UserCreatorService {
  private readonly email: string;
  private readonly password: string;
  private readonly firstName: string;
  private readonly lastName: string;
  private readonly token: string;
  private readonly ignoreSubscribe: boolean;
  private readonly clientInfo: any;
  private readonly nocoConfig: NcConfig;

  constructor(args: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    token?: string;
    ignoreSubscribe?: boolean;
    clientInfo: any;
    nocoConfig: NcConfig;
  }) {
    this.email = args.email;
    this.password = args.password;
    this.firstName = args.firstName;
    this.lastName = args.lastName;
    this.token = args.token;
    this.ignoreSubscribe = args.ignoreSubscribe;
    this.clientInfo = args.clientInfo;
    this.nocoConfig = args.nocoConfig;
  }

  async process() {
    const {
      email: _email,
      password,
      firstName,
      lastName,
      clientInfo,
      ignoreSubscribe,
      token,
      nocoConfig,
    } = this;

    // validate password and throw error if password is satisfying the conditions
    const { valid, error } = validatePassword(password);
    if (!valid) {
      NcError.badRequest(`Password : ${error}`);
    }

    if (!isEmail(_email)) {
      NcError.badRequest(`Invalid email`);
    }

    const email = _email.toLowerCase();

    const user = await User.getByEmail(email);

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
    const passwordHash = await promisify(bcrypt.hash)(password, salt);
    const email_verification_token = uuidv4();

    if (!ignoreSubscribe) {
      Tele.emit('evt_subscribe', email);
    }

    if (user) {
      if (token) {
        await User.update(user.id, {
          firstname: firstName,
          lastname: lastName,
          salt,
          password: passwordHash,
          email_verification_token,
          invite_token: null,
          invite_token_expires: null,
          email: user.email,
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
          count: 1,
        });
      } else {
        if (process.env.NC_INVITE_ONLY_SIGNUP) {
          NcError.badRequest('Not allowed to signup, contact super admin.');
        } else {
          roles = 'user_new';
        }
      }

      const token_version = randomTokenString();

      await User.insert({
        firstname: firstName,
        lastname: lastName,
        email,
        salt,
        password: passwordHash,
        email_verification_token,
        roles,
        token_version,
      });
    }
    const createdUser = await User.getByEmail(email);

    try {
      const template = (await import('./ui/emailTemplates/verify')).default;
      await (
        await NcPluginMgrv2.emailAdapter()
      ).mailSend({
        to: email,
        subject: 'Verify email',
        html: ejs.render(template, {
          verifyLink:
            createdUser.ncSiteUrl +
            `/email/verify/${createdUser.email_verification_token}`,
        }),
      });
    } catch (e) {
      console.log(
        'Warning : `mailSend` failed, Please configure emailClient configuration.'
      );
    }

    const refreshToken = randomTokenString();
    await User.update(createdUser.id, {
      refresh_token: refreshToken,
      email: createdUser.email,
    });

    await Audit.insert({
      op_type: 'AUTHENTICATION',
      op_sub_type: 'SIGNUP',
      user: createdUser.email,
      description: `signed up `,
      ip: clientInfo.clientIp,
    });

    return {
      token: genJwt(createdUser, nocoConfig),
      refreshToken,
    };
  }
}
