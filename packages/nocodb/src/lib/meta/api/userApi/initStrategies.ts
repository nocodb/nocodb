import { OrgUserRoles } from 'nocodb-sdk';
import User from '../../../models/User';
import ProjectUser from '../../../models/ProjectUser';
import { promisify } from 'util';
import { Strategy as CustomStrategy } from 'passport-custom';
import passport from 'passport';
import passportJWT from 'passport-jwt';
import { Strategy as AuthTokenStrategy } from 'passport-auth-token';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { randomTokenString } from '../../helpers/stringHelpers';

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
                if (req.ncProjectId) {
                  ProjectUser.get(req.ncProjectId, user.id)
                    .then(async (projectUser) => {
                      user.roles = projectUser?.roles || user.roles;
                      user.roles =
                        user.roles === 'owner' ? 'owner,creator' : user.roles;
                      // + (user.roles ? `,${user.roles}` : '');
                      // todo : cache
                      // await NocoCache.set(`${CacheScope.USER}:${key}`, user);
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
                  user.roles = projectUser?.roles || user.roles;
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
                    user.roles = projectUser?.roles || user.roles;
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

  router.use(passport.initialize());
}
