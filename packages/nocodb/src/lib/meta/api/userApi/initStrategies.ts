import User from '../../../models/User';
import ProjectUser from '../../../models/ProjectUser';
import { promisify } from 'util';
import { Strategy as CustomStrategy } from 'passport-custom';
import passport from 'passport';
import passportJWT from 'passport-jwt';
import { Strategy as AuthTokenStrategy } from 'passport-auth-token';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as OidcStrategy } from '@techpass/passport-openidconnect';
import { randomTokenString } from '../../helpers/stringHelpers';
import { v4 as uuidv4 } from 'uuid';

const PassportLocalStrategy = require('passport-local').Strategy;
const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromHeader('xc-auth'),
};

import bcrypt from 'bcryptjs';
import Project from '../../../models/Project';
import NocoCache from '../../../cache/NocoCache';
import { CacheGetType, CacheScope } from '../../../utils/globals';
import ApiToken from '../../../models/ApiToken';
import Noco from '../../../Noco';
import Plugin from '../../../models/Plugin';

export function initStrategies(router): void {
  passport.use(
    'authtoken',
    new AuthTokenStrategy({ headerFields: ['xc-token'] }, (token, done) => {
      ApiToken.getByToken(token)
        .then((apiToken) => {
          if (apiToken) {
            done(null, { roles: 'editor' });
          } else {
            return done({ msg: 'Invalid tok' });
          }
        })
        .catch((e) => {
          console.log(e);
          done({ msg: 'Invalid tok' });
        });
    })
  );

  passport.serializeUser(function (
    {
      id,
      email,
      email_verified,
      roles: _roles,
      provider,
      firstname,
      lastname,
      isAuthorized,
      isPublicBase,
      token_version,
    },
    done
  ) {
    const roles = (_roles || '')
      .split(',')
      .reduce((obj, role) => Object.assign(obj, { [role]: true }), {});
    if (roles.owner) {
      roles.creator = true;
    }
    done(null, {
      isAuthorized,
      isPublicBase,
      id,
      email,
      email_verified,
      provider,
      firstname,
      lastname,
      roles,
      token_version,
    });
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });

  passport.use(
    new JwtStrategy(
      {
        secretOrKey: Noco.getConfig().auth.jwt.secret,
        ...jwtOptions,
        passReqToCallback: true,
        ...Noco.getConfig().auth.jwt.options,
      },
      async (req, jwtPayload, done) => {
        const keyVals = [jwtPayload?.email];
        if (req.ncProjectId) {
          keyVals.push(req.ncProjectId);
        }
        const key = keyVals.join('___');
        const cachedVal = await NocoCache.get(
          `${CacheScope.USER}:${key}`,
          CacheGetType.TYPE_OBJECT
        );

        if (cachedVal) {
          if (
            !cachedVal.token_version ||
            !jwtPayload.token_version ||
            cachedVal.token_version !== jwtPayload.token_version
          ) {
            return done(new Error('Token Expired. Please login again.'));
          }
          return done(null, cachedVal);
        }

        User.getByEmail(jwtPayload?.email)
          .then(async (user) => {
            if (
              !user.token_version ||
              !jwtPayload.token_version ||
              user.token_version !== jwtPayload.token_version
            ) {
              return done(new Error('Token Expired. Please login again.'));
            }
            if (req.ncProjectId) {
              // this.xcMeta
              //   .metaGet(req.ncProjectId, null, 'nc_projects_users', {
              //     user_id: user?.id
              //   })

              ProjectUser.get(req.ncProjectId, user.id)
                .then(async (projectUser) => {
                  user.roles = projectUser?.roles || 'user';
                  user.roles =
                    user.roles === 'owner' ? 'owner,creator' : user.roles;
                  // + (user.roles ? `,${user.roles}` : '');

                  await NocoCache.set(`${CacheScope.USER}:${key}`, user);
                  done(null, user);
                })
                .catch((e) => done(e));
            } else {
              // const roles = projectUser?.roles ? JSON.parse(projectUser.roles) : {guest: true};
              if (user) {
                await NocoCache.set(`${CacheScope.USER}:${key}`, user);
                return done(null, user);
              } else {
                return done(new Error('User not found'));
              }
            }
          })
          .catch((err) => {
            return done(err);
          });
      }
    )
  );

  passport.use(
    new PassportLocalStrategy(
      {
        usernameField: 'email',
        session: false,
      },
      async (email, password, done) => {
        try {
          const user = await User.getByEmail(email);
          if (!user) {
            return done({ msg: `Email ${email} is not registered!` });
          }
          const hashedPassword = await promisify(bcrypt.hash)(
            password,
            user.salt
          );
          if (user.password !== hashedPassword) {
            return done({ msg: `Password not valid!` });
          } else {
            return done(null, user);
          }
        } catch (e) {
          done(e);
        }
      }
    )
  );

  passport.use(
    'baseView',
    new CustomStrategy(async (req: any, callback) => {
      let user;
      if (req.headers['xc-shared-base-id']) {
        // const cacheKey = `nc_shared_bases||${req.headers['xc-shared-base-id']}`;

        let sharedProject = null;

        if (!sharedProject) {
          sharedProject = await Project.getByUuid(
            req.headers['xc-shared-base-id']
          );
        }
        user = {
          roles: sharedProject?.roles,
        };
      }

      callback(null, user);
    })
  );

  // mostly copied from older code
  Plugin.getPluginByTitle('Google').then((googlePlugin) => {
    if (googlePlugin && googlePlugin.input) {
      const settings = JSON.parse(googlePlugin.input);
      process.env.NC_GOOGLE_CLIENT_ID = settings.client_id;
      process.env.NC_GOOGLE_CLIENT_SECRET = settings.client_secret;
    }

    if (
      process.env.NC_GOOGLE_CLIENT_ID &&
      process.env.NC_GOOGLE_CLIENT_SECRET
    ) {
      const googleAuthParamsOrig = GoogleStrategy.prototype.authorizationParams;
      GoogleStrategy.prototype.authorizationParams = (options: any) => {
        const params = googleAuthParamsOrig.call(this, options);

        if (options.state) {
          params.state = options.state;
        }

        return params;
      };

      const clientConfig = {
        clientID: process.env.NC_GOOGLE_CLIENT_ID,
        clientSecret: process.env.NC_GOOGLE_CLIENT_SECRET,
        // todo: update url
        callbackURL: 'http://localhost:3000',
        passReqToCallback: true,
      };

      const googleStrategy = new GoogleStrategy(
        clientConfig,
        async (req, _accessToken, _refreshToken, profile, done) => {
          const email = profile.emails[0].value;

          User.getByEmail(email)
            .then(async (user) => {
              if (req.ncProjectId) {
                ProjectUser.get(req.ncProjectId, user.id)
                  .then(async (projectUser) => {
                    user.roles = projectUser?.roles || 'user';
                    user.roles =
                      user.roles === 'owner' ? 'owner,creator' : user.roles;
                    // + (user.roles ? `,${user.roles}` : '');

                    done(null, user);
                  })
                  .catch((e) => done(e));
              } else {
                // const roles = projectUser?.roles ? JSON.parse(projectUser.roles) : {guest: true};
                if (user) {
                  return done(null, user);
                } else {
                  let roles = 'editor';

                  if (!(await User.isFirst())) {
                    roles = 'owner';
                  }
                  if (roles === 'editor') {
                    return done(new Error('User not found'));
                  }
                  const salt = await promisify(bcrypt.genSalt)(10);
                  user = await await User.insert({
                    email: profile.emails[0].value,
                    password: '',
                    salt,
                    roles,
                    email_verified: true,
                    token_version: randomTokenString(),
                  });
                  return done(null, user);
                }
              }
            })
            .catch((err) => {
              return done(err);
            });
        }
      );

      passport.use(googleStrategy);
    }
  });

  // OpenID Connect
  if (
    process.env.NC_OIDC_ISSUER &&
    process.env.NC_OIDC_AUTH_URL &&
    process.env.NC_OIDC_TOKEN_URL &&
    process.env.NC_OIDC_USERINFO_URL &&
    process.env.NC_OIDC_CLIENT_ID &&
    process.env.NC_OIDC_CLIENT_SECRET
  ) {
    const clientConfig = {
      passReqToCallback: true,
      issuer: process.env.NC_OIDC_ISSUER,
      authorizationURL: process.env.NC_OIDC_AUTH_URL,
      tokenURL: process.env.NC_OIDC_TOKEN_URL,
      userInfoURL: process.env.NC_OIDC_USERINFO_URL,
      clientID: process.env.NC_OIDC_CLIENT_ID,
      clientSecret: process.env.NC_OIDC_CLIENT_SECRET,
      scope: ['profile', 'email'],
      store: {
        store: async (_req, meta, callback) => {
          const handle = `oidc|${uuidv4()}`;

          const state = { handle };
          for (let key in meta) {
            state[key] = meta[key];
          }

          NocoCache.set(`${CacheScope.LOGIN}:${handle}`, state).then(
            () => callback(null, handle)
          ).catch(err => callback(err));
        },
        verify: (_req, providedState, callback) => {
          const key = `${CacheScope.LOGIN}:${providedState}`;
          NocoCache.get(key, CacheGetType.TYPE_OBJECT).then(
            async state => {
              if (!state) {
                return callback(null, false, { message: 'Unable to verify authorization request state.' });
              }

              await NocoCache.del(key);
    
              return callback(null, true, state);
            }
          ).catch(err => callback(err));
        }
      }
    };

    const oidcStrategy = new OidcStrategy(
      clientConfig,
      (req, _issuer, _subject, profile, done) => {
        const email = profile?._json?.email;

        User.getByEmail(email)
          .then(async (user) => {
            if (req.ncProjectId) {
              ProjectUser.get(req.ncProjectId, user.id)
                .then(async (projectUser) => {
                  user.roles = projectUser?.roles || 'user';
                  user.roles =
                    user.roles === 'owner' ? 'owner,creator' : user.roles;

                  done(null, user);
                })
                .catch((e) => done(e));
            } else {
              if (user) {
                return done(null, user);
              } else {
                const isFirst = await User.isFirst();
                const roles = isFirst ? 'owner' : 'editor';
                const salt = await promisify(bcrypt.genSalt)(10);
                user = await User.insert({
                  email,
                  password: '',
                  salt,
                  roles,
                  email_verified: true,
                  token_version: randomTokenString(),
                });
                return done(null, user);
              }
            }
          })
          .catch((err) => {
            return done(err);
          });
      }
    )


    passport.use(oidcStrategy);
  }

  router.use(passport.initialize());
}
