import { promisify } from 'util';
import { Injectable, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { Plugin, ProjectUser, User } from '../../models';
import Noco from '../../Noco';
import { UsersService } from '../../services/users/users.service';
import type { VerifyCallback } from 'passport-google-oauth20';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Optional() clientConfig: any,
    private usersService: UsersService,
  ) {
    super(clientConfig);
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    // mostly copied from older code
    const email = profile.emails[0].value;
    try {
      const user = await User.getByEmail(email);
      if (user) {
        // if project id defined extract project level roles
        if (req.ncProjectId) {
          ProjectUser.get(req.ncProjectId, user.id)
            .then(async (projectUser) => {
              user.roles = projectUser?.roles || user.roles;
              user.roles =
                user.roles === 'owner' ? 'owner,creator' : user.roles;
              // + (user.roles ? `,${user.roles}` : '');

              done(null, user);
            })
            .catch((e) => done(e));
        } else {
          return done(null, user);
        }
        // if user not found create new user if allowed
        // or return error
      } else {
        const salt = await promisify(bcrypt.genSalt)(10);
        const user = await this.usersService.registerNewUserIfAllowed({
          display_name: null,
          avatar: null,
          user_name: null,
          email_verification_token: null,
          email: profile.emails[0].value,
          password: '',
          salt,
        });
        return done(null, user);
      }
    } catch (err) {
      return done(err);
    }
  }

  authorizationParams(options: any) {
    const params = super.authorizationParams(options) as Record<string, any>;

    if (options.state) {
      params.state = options.state;
    }

    return params;
  }

  async authenticate(req: any, options?: any): Promise<void> {
    const googlePlugin = await Plugin.getPluginByTitle('Google');

    if (googlePlugin && googlePlugin.input) {
      const settings = JSON.parse(googlePlugin.input);
      process.env.NC_GOOGLE_CLIENT_ID = settings.client_id;
      process.env.NC_GOOGLE_CLIENT_SECRET = settings.client_secret;
    }

    if (
      !process.env.NC_GOOGLE_CLIENT_ID ||
      !process.env.NC_GOOGLE_CLIENT_SECRET
    )
      return this.error({
        message:
          'Google client id or secret not found. Please add it in plugin settings or define env variables.',
      });

    return super.authenticate(req, {
      ...options,
      clientID: process.env.NC_GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.NC_GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: req.ncSiteUrl + Noco.getConfig().dashboardPath,
      passReqToCallback: true,
      scope: ['profile', 'email'],
      state: req.query.state,
    });
  }
}

export const GoogleStrategyProvider: FactoryProvider = {
  provide: GoogleStrategy,
  inject: [UsersService],
  useFactory: async (usersService: UsersService) => {
    // read client id and secret from env variables
    // if not found provide dummy values to avoid error
    // it will be handled in authenticate method ( reading from plugin )
    const clientConfig = {
      clientID: process.env.NC_GOOGLE_CLIENT_ID ?? 'dummy-id',
      clientSecret: process.env.NC_GOOGLE_CLIENT_SECRET ?? 'dummy-secret',
      // todo: update url
      callbackURL: 'http://localhost:8080/dahsboard',
      passReqToCallback: true,
      scope: ['profile', 'email'],
    };

    return new GoogleStrategy(clientConfig, usersService);
  },
};
