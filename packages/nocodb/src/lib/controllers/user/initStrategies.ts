import { OrgUserRoles } from 'nocodb-sdk';
import { promisify } from 'util';
import { Strategy as CustomStrategy } from 'passport-custom';
import passport from 'passport';
import passportJWT from 'passport-jwt';
import { Strategy as AuthTokenStrategy } from 'passport-auth-token';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as OidcStrategy } from '@techpass/passport-openidconnect';

const PassportLocalStrategy = require('passport-local').Strategy;
const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromHeader('xc-auth'),
};

import bcrypt from 'bcryptjs';
import NocoCache from '../../cache/NocoCache';
import { ApiToken, Base, Plugin, Project, ProjectUser, User, WorkspaceUser } from '../../models';
import Noco from '../../Noco';
import { CacheGetType, CacheScope } from '../../utils/globals';
import { userService } from '../../services';
import { v4 as uuidv4 } from 'uuid';
import { registerNewUserIfAllowed } from './helpers';

export function initStrategies(router): void {
  passport.use(
    'authtoken',
    new AuthTokenStrategy(
      { headerFields: ['xc-token'], passReqToCallback: true },
      (req, token, done) => {
        ApiToken.getByToken(token)
          .then((apiToken) => {
            if (!apiToken) {
              return done({ msg: 'Invalid token' });
            }

            if (!apiToken.fk_user_id) return done(null, { roles: 'editor' });
            User.get(apiToken.fk_user_id)
              .then((user) => {
                user['is_api_token'] = true;

                if (req.ncWorkspaceId) {
                  // extract workspace role
                  WorkspaceUser.get(req.ncWorkspaceId, user.id)
                    .then((workspaceUser) => {
                      user.roles = user.roles + ',' + workspaceUser?.roles;

                      done(null, user);
                    })
                    .catch((e) => done(e));
                }

                if (req.ncProjectId) {
                  ProjectUser.get(req.ncProjectId, user.id)
                    .then(async (projectUser) => {
                      user.roles =
                        user.roles +
                        ',' +
                        (projectUser.roles === 'owner'
                          ? 'owner,creator'
                          : projectUser.roles);

                      done(null, user);
                    })
                    .catch((e) => done(e));
                } else {
                  return done(null, user);
                }
              })
              .catch((e) => {
                console.log(e);
                done({ msg: 'User not found' });
              });
          })
          .catch((e) => {
            console.log(e);
            done({ msg: 'Invalid token' });
          });
      }
    )
  );

  passport.serializeUser(function (
    {
      id,
      email,
      email_verified,
      roles: _roles,
      provider,
      avatar,
      display_name,
      user_name,
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
      avatar,
      display_name,
      user_name,
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
        // todo: improve this
        if (
          req.ncProjectId &&
          jwtPayload.roles?.split(',').includes(OrgUserRoles.SUPER_ADMIN)
        ) {
          return User.getByEmail(jwtPayload?.email).then(async (user) => {
            return done(null, {
              ...user,
              roles: `owner,creator,${OrgUserRoles.SUPER_ADMIN}`,
            });
          });
        }

        /*
                const keyVals = [jwtPayload?.email];
                if (req.ncProjectId) {
                  keyVals.push(req.ncProjectId);
                }
                // const key = keyVals.join('___');
                const cachedVal = null;
                // todo: enable
                /!*await NocoCache.get(
                  `${CacheScope.USER}:${key}`,
                  CacheGetType.TYPE_OBJECT
                );*!/

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
        */

        User.getByEmail(jwtPayload?.email)
          .then(async (user) => {
            if (
              !user.token_version ||
              !jwtPayload.token_version ||
              user.token_version !== jwtPayload.token_version
            ) {
              return done(new Error('Token Expired. Please login again.'));
            }

            Promise.all([
              // extract workspace evel roles
              new Promise((resolve) => {
                if (req.ncWorkspaceId) {
                  // todo: cache
                  // extract workspace role
                  WorkspaceUser.get(req.ncWorkspaceId, user.id)
                    .then((workspaceUser) => {
                      resolve(workspaceUser?.roles);
                    })
                    .catch(() => resolve(null));
                } else {
                  resolve(null);
                }
              }),
              // extract project level roles
              new Promise((resolve) => {
                if (req.ncProjectId) {
                  ProjectUser.get(req.ncProjectId, user.id)
                    .then(async (projectUser) => {
                      let roles = projectUser?.roles;
                      roles = roles === 'owner' ? 'owner,creator' : roles;
                      // + (user.roles ? `,${user.roles}` : '');
                      resolve(roles);
                      // todo: cache
                    })
                    .catch((e) => done(e));
                } else {
                  resolve(null);
                }
              }),
            ]).then(([workspaceRoles, projectRoles]) => {
              done(null, {
                ...user,
                roles: [user.roles, workspaceRoles, projectRoles]
                  .filter(Boolean)
                  .join(','),
              });
            });
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

          if (!user.salt) {
            return done({
              msg: `Please sign up with the invite token first or reset the password by clicking Forgot your password.`,
            });
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

  passport.use(
    'erdView',
    new CustomStrategy(async (req: any, callback) => {
      let user;
      if (req.headers['xc-shared-erd-id']) {
        let sharedProject = null;

        if (!sharedProject) {
          const sharedBase = await Base.getByUUID(req.headers['xc-shared-erd-id']);
          sharedProject = await Project.getByTitleOrId(sharedBase?.project_id);
        }
        user = {
          roles: 'viewer',
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
      };

      const googleStrategy = new GoogleStrategy(
        clientConfig,
        async (_accessToken, _refreshToken, profile, done) => {
          const email = profile.emails[0].value;

          User.getByEmail(email)
            .then(async (user) => {
              if (user) {
                return done(null, user);
                // if user not found create new user if allowed
                // or return error
              } else {
                const salt = await promisify(bcrypt.genSalt)(10);
                const user = await userService.registerNewUserIfAllowed({
                  avatar: null,
                  user_name: null,
                  display_name: null,
                  email_verification_token: null,
                  email: profile.emails[0].value,
                  password: '',
                  salt,
                });
                return done(null, user);
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

    const oidcStrategy = new OidcStrategy(
      clientConfig,
      (_issuer, _subject, profile, done) => {
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
              registerNewUserIfAllowed({
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
    );

    passport.use(oidcStrategy);
  }

  router.use(passport.initialize());
}
