import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import type { AppConfig } from '~/interface/config';
import { sanitiseUserObj } from '~/utils';
import { UsersService } from '~/services/users/users.service';
import { User } from '~/models';

@Injectable()
export class CognitoStrategy extends PassportStrategy(Strategy, 'cognito') {
  constructor(
    private configService: ConfigService<AppConfig>,
    private usersService: UsersService,
  ) {
    super();
  }

  async validate(req: any, callback) {
    try {
      if (req.headers['xc-cognito']) {
        // todo: replace with env/config
        const verifier = CognitoJwtVerifier.create({
          userPoolId: 'us-east-2_MNegyNf5T',
          tokenUse: 'id',
          clientId: '5lo3lv5kj4t4nukutsvmbbq5s7',
        });

        const payload = await verifier.verify(req.headers['xc-cognito']);
        console.log('Token is valid. Payload:', payload);
        const email = (payload as any)['email'];
        // get user by email
        await User.getByEmail(email).then(async (user) => {
          if (user) {
            return callback(null, {
              ...sanitiseUserObj(user),
              provider: 'cognito',
              // display_name: profile._json?.name,
              display_name: '',
            });
          } else {
            try {
              // if user not found create new user
              const salt = await promisify(bcrypt.genSalt)(10);
              const user = await this.usersService.registerNewUserIfAllowed({
                email,
                password: '',
                email_verification_token: null,
                avatar: null,
                user_name: null,
                display_name: '',
                // display_name: profile._json?.name,
                salt,
              });

              return callback(null, {
                ...sanitiseUserObj(user),
                provider: 'openid',
              });
            } catch (err) {
              return callback(err);
            }
          }
        });
      } else {
        return callback(new Error('No token found'));
      }
    } catch (error) {
      return callback(error);
    }
  }
}

export const CognitoStrategyProvider: FactoryProvider = {
  provide: CognitoStrategy,
  inject: [UsersService, ConfigService<AppConfig>],
  useFactory: async (
    usersService: UsersService,
    config: ConfigService<AppConfig>,
  ) => {
    // OpenID Connect
    // if (
    //   process.env.NC_OIDC_ISSUER &&
    //   process.env.NC_OIDC_AUTHORIZATION_URL &&
    //   process.env.NC_OIDC_TOKEN_URL &&
    //   process.env.NC_OIDC_USERINFO_URL &&
    //   process.env.NC_OIDC_CLIENT_ID &&
    //   process.env.NC_OIDC_CLIENT_SECRET
    // ) {
    //   const clientConfig = {
    //     issuer: process.env.NC_OIDC_ISSUER,
    //     authorizationURL: process.env.NC_OIDC_AUTHORIZATION_URL,
    //     tokenURL: process.env.NC_OIDC_TOKEN_URL,
    //     userInfoURL: process.env.NC_OIDC_USERINFO_URL,
    //     clientID: process.env.NC_OIDC_CLIENT_ID,
    //     clientSecret: process.env.NC_OIDC_CLIENT_SECRET,
    //     scope: ['profile', 'email'],
    //
    //     // cache based store for managing the state of the authorization request
    //     store: {
    //       store: async (req, meta, callback) => {
    //         const handle = `oidc_${uuidv4()}`;
    //         let host: string;
    //         let continueAfterSignIn: string;
    //
    //         // extract workspace id from query params if available
    //         // and ignore if it's main sub-domain
    //         if (
    //           req.query.workspaceId &&
    //           req.query.workspaceId !==
    //           config.get('mainSubDomain', { infer: true })
    //         ) {
    //           host = `${req.query.workspaceId}.${process.env.NC_BASE_HOST_NAME}`;
    //         } else {
    //           // extract host from siteUrl but this approach only works with upgraded workspace
    //           const url = new URL(req.ncSiteUrl);
    //           host = url.host;
    //         }
    //
    //         if (req.query.continueAfterSignIn) {
    //           continueAfterSignIn = req.query.continueAfterSignIn;
    //         }
    //
    //         const state = { handle, host, continueAfterSignIn };
    //         for (const key in meta) {
    //           state[key] = meta[key];
    //         }
    //
    //         NocoCache.set(`oidc:${handle}`, state)
    //           .then(() => callback(null, handle))
    //           .catch((err) => callback(err));
    //       },
    //       verify: (req, providedState, callback) => {
    //         const key = `oidc:${providedState}`;
    //         NocoCache.get(key, CacheGetType.TYPE_OBJECT)
    //           .then(async (state) => {
    //             if (!state) {
    //               return callback(null, false, {
    //                 message: 'Unable to verify authorization request state.',
    //               });
    //             }
    //
    //             req.extra = {
    //               continueAfterSignIn: state.continueAfterSignIn,
    //             };
    //             req.ncRedirectHost = state.host;
    //
    //             await NocoCache.del(key);
    //             return callback(null, true, state);
    //           })
    //           .catch((err) => callback(err));
    //       },
    //     },
    //   };

    // return new OpenidStrategy(clientConfig, config, usersService);
    return new CognitoStrategy(config, usersService);
    // }
    // return null;
  },
};
