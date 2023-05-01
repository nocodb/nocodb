import { promisify } from 'util';
import { Injectable, Optional } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OpenIDConnectStrategy } from '@techpass/passport-openidconnect';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../models';
import Noco from '../../Noco';
import NocoCache from '../../cache/NocoCache';
import { CacheGetType } from '../../utils/globals';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';

@Injectable()
export class OpenidStrategy extends PassportStrategy(
  OpenIDConnectStrategy,
  'openid',
) {
  constructor(@Optional() clientConfig: any) {
    super(clientConfig);
  }

  async validate(_issuer, _subject, profile, done) {
    const email = profile.email || profile?._json?.email;

    if (!email) {
      return done({ msg: `User account is missing email id` });
    }

    // get user by email
    User.getByEmail(email)
      .then(async (user) => {
        if (user) {
          return done(null, { ...user, provider: 'openid' });
        } else {
          // if user not found create new user
          const salt = await promisify(bcrypt.genSalt)(10);
          await this.userService
            .registerNewUserIfAllowed({
              email,
              password: '',
              email_verification_token: null,
              avatar: null,
              user_name: null,
              display_name: profile._json?.name,
              salt,
            })
            .then((user) => {
              done(null, { ...user, provider: 'openid' });
            })
            .catch((e) => done(e));
        }
      })
      .catch((err) => {
        return done(err);
      });
  }

  async authenticate(req: any, options?: any): Promise<void> {
    return super.authenticate(req, {
      ...options,
      scope: ['profile', 'email'],
      callbackURL: req.ncSiteUrl + Noco.getConfig().dashboardPath,
    });
  }
}

export const OpenidStrategyProvider: FactoryProvider = {
  provide: OpenidStrategy,
  useFactory: async () => {
    // OpenID Connect
    if (
      process.env.NC_OIDC_ISSUER &&
      process.env.NC_OIDC_AUTHORIZATION_URL &&
      process.env.NC_OIDC_TOKEN_URL &&
      process.env.NC_OIDC_USERINFO_URL &&
      process.env.NC_OIDC_CLIENT_ID &&
      process.env.NC_OIDC_CLIENT_SECRET
    ) {
      const clientConfig = {
        issuer: process.env.NC_OIDC_ISSUER,
        authorizationURL: process.env.NC_OIDC_AUTHORIZATION_URL,
        tokenURL: process.env.NC_OIDC_TOKEN_URL,
        userInfoURL: process.env.NC_OIDC_USERINFO_URL,
        clientID: process.env.NC_OIDC_CLIENT_ID,
        clientSecret: process.env.NC_OIDC_CLIENT_SECRET,
        scope: ['profile', 'email'],

        // cache based store for managing the state of the authorization request
        store: {
          store: async (_req, meta, callback) => {
            const handle = `oidc_${uuidv4()}`;

            const state = { handle };
            for (const key in meta) {
              state[key] = meta[key];
            }

            NocoCache.set(`oidc:${handle}`, state)
              .then(() => callback(null, handle))
              .catch((err) => callback(err));
          },
          verify: (_req, providedState, callback) => {
            const key = `oidc:${providedState}`;
            NocoCache.get(key, CacheGetType.TYPE_OBJECT)
              .then(async (state) => {
                if (!state) {
                  return callback(null, false, {
                    message: 'Unable to verify authorization request state.',
                  });
                }

                await NocoCache.del(key);
                return callback(null, true, state);
              })
              .catch((err) => callback(err));
          },
        },
      };

      return new OpenidStrategy(clientConfig);
    }
    return null;
  },
};
