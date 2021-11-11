import { promisify } from 'util';

import bcrypt from 'bcryptjs';
import * as ejs from 'ejs';
import * as jwt from 'jsonwebtoken';
import { Tele } from 'nc-help';
import passport from 'passport';
import { Strategy as AuthTokenStrategy } from 'passport-auth-token';
import { Strategy as GithubStrategy } from 'passport-github';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { ExtractJwt, Strategy } from 'passport-jwt';
import validator from 'validator';

import { DbConfig, NcConfig } from '../../../interface/config';
import { Knex } from '../../dataMapper';
import Noco from '../Noco';

const autoBind = require('auto-bind');
const PassportLocalStrategy = require('passport-local').Strategy;
import { Strategy as CustomStrategy } from 'passport-custom';

const { v4: uuidv4 } = require('uuid');

import * as crypto from 'crypto';

import NcMetaIO from '../meta/NcMetaIO';

const { isEmail } = require('validator');

import axios from 'axios';

import IEmailAdapter from '../../../interface/IEmailAdapter';
import XcCache from '../plugins/adapters/cache/XcCache';

passport.serializeUser(function(
  {
    id,
    email,
    email_verified,
    roles,
    provider,
    firstname,
    lastname,
    isAuthorized,
    isPublicBase
  },
  done
) {
  done(null, {
    isAuthorized,
    isPublicBase,
    id,
    email,
    email_verified,
    provider,
    firstname,
    lastname,
    roles: (roles || '')
      .split(',')
      .reduce((obj, role) => Object.assign(obj, { [role]: true }), {})
  });
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

const NC_ROLES = 'nc_roles';
const NC_ACL = 'nc_acl';
export default class RestAuthCtrl {
  protected app: Noco;

  protected dbDriver: Knex;
  // @ts-ignore
  protected connectionConfig: DbConfig;
  protected config: NcConfig;

  protected jwtOptions: any;

  protected xcMeta: NcMetaIO;

  public static instance: RestAuthCtrl;

  protected apiTokens: Array<{
    token: string;
    [key: string]: any;
  }>;

  // private router:Router;

  constructor(
    app: Noco,
    dbDriver: Knex,
    connectionConfig: DbConfig,
    config: NcConfig,
    xcMeta?: NcMetaIO
  ) {
    this.app = app;
    this.dbDriver = dbDriver;
    this.connectionConfig = connectionConfig;
    this.config = config;
    this.xcMeta = xcMeta;
    autoBind(this);
    // todo: default secret generation
    this.config.auth.jwt.secret = this.config?.auth?.jwt?.secret ?? 'secret';
    this.jwtOptions = {
      secretOrKey: this.config.auth.jwt.secret,
      expiresIn: process.env.NC_JWT_EXPIRES_IN ?? '10h'
    };
    this.jwtOptions.jwtFromRequest = ExtractJwt.fromHeader('xc-auth');
    if (this.config?.auth?.jwt?.options) {
      Object.assign(this.jwtOptions, this.config?.auth?.jwt?.options);
    }
    // this.router = Router();
    RestAuthCtrl.instance = this;
  }

  get users(): any {
    return this.dbDriver('xc_users');
  }

  async init() {
    await this.loadLatestApiTokens();
    await this.createAuthTableIfNotExists();

    await this.initStrategies();
    this.app.router.use(passport.initialize());

    const jwtMiddleware = passport.authenticate('jwt', { session: false });

    this.app.router.get('/password/reset/:token', async function(req, res) {
      res.send(
        ejs.render((await import('./ui/auth/resetPassword')).default, {
          token: JSON.stringify(req.params?.token),
          baseUrl: `/`
        })
      );
    });
    this.app.router.get('/email/verify/:token', async (req, res) => {
      res.send(
        ejs.render((await import('./ui/auth/emailVerify')).default, {
          token: JSON.stringify(req.params?.token),
          baseUrl: `/`
        })
      );
    });

    this.app.router.get('/signin', async (_req, res) => {
      res.send(
        ejs.render((await import('./ui/auth/signin')).default, {
          baseUrl: `/`
        })
      );
    });

    this.app.router.get('/signup', async (_req, res) => {
      res.render(
        ejs.render((await import('./ui/auth/signup')).default, {
          baseUrl: `/`
        })
      );
    });

    this.app.router.post(`/auth/signin`, this.signin);

    this.app.router.post(`/auth/signup`, this.signup);
    this.app.router.post(`/auth/refresh-token`, this.refreshToken);

    /* Google auth apis */

    this.app.router.post(`/auth/google/genTokenByCode`, this.googleSignin);

    this.app.router.get('/auth/google', (req: any, res, next) =>
      passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: req.query.state,
        callbackURL: req.ncSiteUrl + this.config.dashboardPath
      })(req, res, next)
    );
    /* Github auth apis */

    this.app.router.post(`/auth/github/genTokenByCode`, this.githubSignin);

    this.app.router.get('/auth/github', (req: any, res, next) =>
      passport.authenticate('github', {
        scope: ['profile', 'email'],
        state: `github|${req.query.state || ''}`,
        callbackURL: req.ncSiteUrl + this.config.dashboardPath
      })(req, res, next)
    );

    /*
        this.app.router.get('/auth/azureadoauth2',
          passport.authenticate('azure_ad_oauth2'));

        this.app.router.get('/auth/azureadoauth2/callback',
          passport.authenticate('azure_ad_oauth2', { failureRedirect: '/login' }),
           (_req, res) => {
            // Successful authentication, redirect home.
            res.redirect('/');
          });
    */

    this.app.router.post(`/auth/password/forgot`, this.passwordForgot);
    this.app.router.post(`/auth/token/validate/:tokenId`, this.tokenValidate);
    this.app.router.post(`/auth/password/reset/:tokenId`, this.passwordReset);
    this.app.router.post(
      `/user/password/change`,
      jwtMiddleware,
      this.passwordChange
    );
    this.app.router.post(
      `/auth/email/validate/:tokenId`,
      this.emailVerification
    );
    this.app.router.put(`/user`, jwtMiddleware, this.updateUser);

    // middleware for setting passport user( for treating non-authenticated user as guest)
    this.app.router.use(async (req, res, next) => {
      const user = await new Promise(resolve => {
        passport.authenticate(
          'jwt',
          { session: false },
          (_err, user, _info) => {
            if (user) {
              if (
                req.path.indexOf('/user/me') === -1 &&
                req.header('xc-preview') &&
                /(?:^|,)(?:owner|creator)(?:$|,)/.test(user.roles)
              ) {
                return resolve({
                  ...user,
                  isAuthorized: true,
                  roles: req.header('xc-preview')
                });
              }

              return resolve({ ...user, isAuthorized: true });
            }

            if (req.headers['xc-token']) {
              passport.authenticate(
                'authtoken',
                {
                  session: false,
                  optional: false
                },
                (_err, user, _info) => {
                  if (user) {
                    return resolve({ ...user, isAuthorized: true });
                  } else {
                    resolve({ roles: 'guest' });
                  }
                }
              )(req, res, next);
            } else if (req.headers['xc-shared-base-id']) {
              passport.authenticate('baseView', {}, (_err, user, _info) => {
                if (user) {
                  return resolve({
                    ...user,
                    isAuthorized: true,
                    isPublicBase: true
                  });
                } else {
                  resolve({ roles: 'guest' });
                }
              })(req, res, next);
            } else {
              resolve({ roles: 'guest' });
            }
          }
        )(req, res, next);
      });

      await promisify((req as any).login.bind(req))(user);
      next();
    });

    this.app.router.get(`/user/me`, this.me);

    /* Admin APIs */
    this.app.router.use('/admin', this.isAdmin);

    this.app.router.get('/admin/roles', this.listRoles);
    this.app.router.delete('/admin/roles/:id', this.deleteRole);
    this.app.router.put('/admin/roles', this.saveOrUpdateRoles);

    this.app.router.post('/admin', this.addAdmin);
    this.app.router.put('/admin/:id', this.updateAdmin);
    this.app.router.delete('/admin/:id', this.deleteAdmin);
    this.app.router.get('/admin', this.listUsers);
    this.app.router.post('/admin/resendInvite/:id', this.resendInvite);
  }

  public async initStrategies(): Promise<void> {
    const self = this;

    passport.use(
      'authtoken',
      new AuthTokenStrategy({ headerFields: ['xc-token'] }, (token, done) => {
        const apiToken = this.apiTokens?.find(t => t.token === token);
        if (apiToken) {
          done(null, { roles: 'editor' });
        } else {
          return done({ msg: 'Invalid tok' });
        }
      })
    );
    this.initCustomStrategy();
    this.initJwtStrategy();

    passport.use(
      new PassportLocalStrategy(
        {
          usernameField: 'email',
          session: false
        },
        async (email, password, done) => {
          try {
            const user = await self.users.where({ email }).first();
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

    const googlePlugin = await this.xcMeta.metaGet(null, null, 'nc_plugins', {
      title: 'Google'
    });

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
        passReqToCallback: true
      };

      const googleStrategy = new GoogleStrategy(
        clientConfig,
        async (req, _accessToken, _refreshToken, profile, cb) => {
          try {
            const email = profile.emails[0].value;

            let user = await this.users
              .where({
                email
              })
              .first();
            const token = req.query.state;

            if (token) {
              Tele.emit('evt_subscribe', email);
              await this.users
                .update({
                  // firstname, lastname,
                  // email_verification_token,
                  invite_token: null,
                  invite_token_expires: null,
                  email_verified: true
                })
                .where({
                  email,
                  invite_token: token
                });
            } else {
              let roles = 'editor';

              if (!(await this.users.first())) {
                roles = 'owner,creator,editor';
              }

              if (!user) {
                if (roles === 'editor') {
                  return cb({ msg: `Account not found!` });
                }

                Tele.emit('evt_subscribe', email);
                const salt = await promisify(bcrypt.genSalt)(10);
                user = await this.users.insert({
                  email: profile.emails[0].value,
                  password: '',
                  salt,
                  roles,
                  email_verified: true
                });
              } else {
                await this.users
                  .update({
                    email_verified: true
                  })
                  .where({
                    email
                  });
              }
              user = await this.users
                .where({
                  email
                })
                .first();
            }
            cb(null, user);
          } catch (e) {
            cb(e, null);
          }
        }
      );

      passport.use(googleStrategy);
    }

    const githubPlugin = await this.xcMeta.metaGet(null, null, 'nc_plugins', {
      title: 'Github'
    });
    if (githubPlugin && githubPlugin.input) {
      const settings = JSON.parse(githubPlugin.input);
      process.env.NC_GITHUB_CLIENT_ID = settings.client_id;
      process.env.NC_GITHUB_CLIENT_SECRET = settings.client_secret;
    }

    if (
      process.env.NC_GITHUB_CLIENT_ID &&
      process.env.NC_GITHUB_CLIENT_SECRET
    ) {
      const githubStrategy = new GithubStrategy(
        {
          clientID: process.env.NC_GITHUB_CLIENT_ID,
          clientSecret: process.env.NC_GITHUB_CLIENT_SECRET,
          // callbackURL: app.$config.auth.github.callbackUrl,
          passReqToCallback: true
        },
        async (req, accessToken, _refreshToken, profile, cb) => {
          try {
            let email =
              profile.emails && profile.emails[0] && profile.emails[0].value;
            if (!email) {
              const res = await axios.get('https://api.github.com/user', {
                headers: {
                  Authorization: 'token ' + accessToken
                }
              });
              if (res.data && res.data.length) {
                email = res.data[0].email;
              } else {
                return cb(null, false, {
                  message:
                    'There is no email id associated to your github account.'
                });
              }
            }

            let user = await this.users
              .where({
                email
              })
              .first();
            const token = req.query?.state?.replace('github|', '');

            if (token) {
              Tele.emit('evt_subscribe', email);
              await this.users
                .update({
                  // firstname, lastname,
                  // email_verification_token,
                  invite_token: null,
                  invite_token_expires: null,
                  email_verified: true
                })
                .where({
                  email,
                  invite_token: token
                });
            } else {
              let roles = 'editor';

              if (!(await this.users.first())) {
                roles = 'owner,creator,editor';
              }

              if (!user) {
                if (roles === 'editor') {
                  return cb({ msg: `Account not found!` });
                }

                Tele.emit('evt_subscribe', email);
                const salt = await promisify(bcrypt.genSalt)(10);
                user = await this.users.insert({
                  email: profile.emails[0].value,
                  password: '',
                  salt,
                  roles,
                  email_verified: true
                });
              } else {
                await this.users
                  .update({
                    email_verified: true
                  })
                  .where({
                    email
                  });
              }
              user = await this.users
                .where({
                  email
                })
                .first();
            }
            cb(null, user);
          } catch (e) {
            cb(e, null);
          }
        }
      );

      passport.use(githubStrategy);
    }

    /*    passport.use(new AzureAdOAuth2Strategy({

          },
          (_accessToken, _refresh_token, params, profile, done) => {
            // currently we can't find a way to exchange access token by user info (see userProfile implementation), so
            // you will need a jwt-package like https://github.com/auth0/node-jsonwebtoken to decode id_token and get waad profile
            const waadProfile = profile || jwt.decode(params.id_token);

            // this is just an example: here you would provide a model *User* with the function *findOrCreate*
            done(waadProfile)
          }));*/
  }

  protected initJwtStrategy() {
    passport.use(
      new Strategy(this.jwtOptions, (jwtPayload, done) => {
        this.users
          .where({
            email: jwtPayload?.email
          })
          .first()
          .then(user => {
            if (user) {
              user.roles = 'owner,creator';
              return done(null, user);
            } else {
              return done(new Error('User not found'));
            }
          })
          .catch(err => {
            return done(err);
          });
      })
    );
  }

  protected initCustomStrategy() {
    passport.use(
      'baseView',
      new CustomStrategy(async (req: any, callback) => {
        let user;
        if (req.headers['xc-shared-base-id']) {
          const sharedBase = await this.xcMeta
            .knex('nc_shared_bases')
            .where({
              enabled: true,
              shared_base_id: req.headers['xc-shared-base-id']
            })
            .first();

          user = {
            roles: sharedBase?.roles
          };
        }

        callback(null, user);
      })
    );
  }

  protected async signin(req, res, next): Promise<any> {
    passport.authenticate(
      'local',
      { session: false },
      async (err, user, info): Promise<any> => {
        try {
          if (!user || !user.email) {
            if (err) {
              return res.status(400).send(err);
            }
            if (info) {
              return res.status(400).send(info);
            }
            return res.status(400).send({ msg: 'Your signin has failed' });
          }

          await promisify((req as any).login.bind(req))(user);
          const refreshToken = this.randomTokenString();

          await this.users
            .update({
              refresh_token: refreshToken
            })
            .where({ id: user.id });

          this.setTokenCookie(res, refreshToken);

          this.xcMeta.audit(null, null, 'nc_audit', {
            op_type: 'AUTHENTICATION',
            op_sub_type: 'SIGNIN',
            user: user.email,
            ip: req.clientIp,
            description: `signed in`
          });

          res.json({
            token: jwt.sign(
              {
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                id: user.id,
                roles: user.roles
              },
              this.config.auth.jwt.secret,
              this.config.auth.jwt.options
            )
          } as any);
        } catch (e) {
          console.log(e);
          throw e;
        }
      }
    )(req, res, next);
  }

  protected async googleSignin(req, res, next): Promise<any> {
    passport.authenticate(
      'google',
      {
        session: false,
        callbackURL: req.ncSiteUrl + this.config.dashboardPath
      },
      async (err, user, info): Promise<any> => {
        try {
          if (!user || !user.email) {
            if (err) {
              return res.status(400).send(err);
            }
            if (info) {
              return res.status(400).send(info);
            }
            return res.status(500).send({ msg: 'Your signin has failed' });
          }

          await promisify((req as any).login.bind(req))(user);
          const refreshToken = this.randomTokenString();

          await this.users
            .update({
              refresh_token: refreshToken
            })
            .where({ id: user.id });

          this.setTokenCookie(res, refreshToken);

          this.xcMeta.audit(null, null, 'nc_audit', {
            op_type: 'AUTHENTICATION',
            op_sub_type: 'SIGNIN',
            user: user.email,
            ip: req.clientIp,
            description: `signed in using Google Auth`
          });

          res.json({
            token: jwt.sign(
              {
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                id: user.id,
                roles: user.roles
              },
              this.config.auth.jwt.secret,
              this.config.auth.jwt.options
            )
          } as any);
        } catch (e) {
          console.log(e);
          throw e;
        }
      }
    )(req, res, next);
  }

  protected async githubSignin(req, res, next): Promise<any> {
    passport.authenticate(
      'github',
      {
        session: false,
        callbackURL: req.ncSiteUrl + this.config.dashboardPath
      },
      async (err, user, info): Promise<any> => {
        try {
          if (!user || !user.email) {
            if (err) {
              return res.status(400).send(err);
            }
            if (info) {
              return res.status(400).send(info);
            }
            return res.status(500).send({ msg: 'Your signin has failed' });
          }

          await promisify((req as any).login.bind(req))(user);
          const refreshToken = this.randomTokenString();

          await this.users
            .update({
              refresh_token: refreshToken
            })
            .where({ id: user.id });

          this.setTokenCookie(res, refreshToken);

          res.json({
            token: jwt.sign(
              {
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                id: user.id,
                roles: user.roles
              },
              this.config.auth.jwt.secret,
              this.config.auth.jwt.options
            )
          } as any);
        } catch (e) {
          console.log(e);
          throw e;
        }
      }
    )(req, res, next);
  }

  protected async refreshToken(req, res): Promise<any> {
    console.log('token refresh');
    try {
      if (!req?.cookies?.refresh_token) {
        return res.status(400).json({ msg: 'Missing refresh token' });
      }

      const user = await this.users
        .where({
          refresh_token: req.cookies.refresh_token
        })
        .first();

      if (!user) {
        return res.status(400).json({ msg: 'Invalid refresh token' });
      }

      const refreshToken = this.randomTokenString();

      await this.users
        .update({
          refresh_token: refreshToken
        })
        .where({
          id: user.id
        });

      this.setTokenCookie(res, refreshToken);

      res.json({
        token: jwt.sign(
          {
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            id: user.id,
            roles: user.roles
          },
          this.config.auth.jwt.secret,
          this.config.auth.jwt.options
        )
      } as any);
    } catch (e) {
      return res.status(400).json({ msg: e.message });
    }
  }

  protected async signup(req, res, next): Promise<any> {
    try {
      const {
        email: _email,
        firstname,
        lastname,
        token,
        ignore_subscribe
      } = req.body;
      let { password } = req.body;

      if (!isEmail(_email)) {
        return next(new Error(`Invalid email`));
      }

      const email = _email.toLowerCase();

      let user = await this.users
        .where({
          email
        })
        .first();

      if (user) {
        if (token) {
          if (token !== user.invite_token) {
            return next(new Error(`Invalid invite url`));
          } else if (user.invite_token_expires < new Date()) {
            return next(
              new Error(
                'Expired invite url, Please contact super admin to get a new invite url'
              )
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
        Tele.emit('evt_subscribe', email);
      }

      if (user) {
        if (token) {
          await this.users
            .update({
              firstname,
              lastname,
              salt,
              password,
              email_verification_token,
              invite_token: null,
              invite_token_expires: null
            })
            .where({
              email,
              invite_token: token
            });
        } else {
          return next(new Error('User already exist'));
        }
      } else {
        let roles = 'user';

        if (!(await this.users.first())) {
          // roles = 'owner,creator,editor'
        } else {
          if (process.env.NC_INVITE_ONLY_SIGNUP) {
            return next(
              new Error('Not allowed to signup, contact super admin.')
            );
          } else {
            roles = 'user_new';
          }
        }

        await this.users.insert({
          firstname,
          lastname,
          email,
          salt,
          password,
          email_verification_token,
          roles
        });
      }
      user = await this.users
        .where({
          email
        })
        .first();

      try {
        const template = (await import('./ui/emailTemplates/verify')).default;
        await this.emailClient.mailSend({
          to: email,
          subject: 'Verify email',
          html: ejs.render(template, {
            verifyLink:
              req.ncSiteUrl + `/email/verify/${user.email_verification_token}`
          })
        });
      } catch (e) {
        console.log(
          'Warning : `mailSend` failed, Please configure emailClient configuration.'
        );
      }
      await promisify((req as any).login.bind(req))(user);
      const refreshToken = this.randomTokenString();
      await this.users
        .update({
          refresh_token: refreshToken
        })
        .where({
          id: user.id
        });

      this.setTokenCookie(res, refreshToken);

      user = (req as any).user;

      this.xcMeta.audit(null, null, 'nc_audit', {
        op_type: 'AUTHENTICATION',
        op_sub_type: 'SIGNUP',
        user: user.email,
        description: `signed up `,
        ip: req.clientIp
      });

      res.json({
        token: jwt.sign(
          {
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            id: user.id,
            roles: user.roles
          },
          this.config.auth.jwt.secret
        )
      } as any);
    } catch (e) {
      console.log(e);
      next(e);
    }
  }

  protected async passwordForgot(req, res, next): Promise<any> {
    const _email = req.body.email;
    if (!_email) {
      return next(new Error('Please enter your email address.'));
    }

    const email = _email.toLowerCase();

    const user = await this.users.where({ email }).first();
    if (!user) {
      return next(new Error('This email is not registered with us.'));
    }

    const token = uuidv4();
    await this.users
      .update({
        reset_password_token: token,
        reset_password_expires: new Date(Date.now() + 60 * 60 * 1000)
      })
      .where({ id: user.id });

    try {
      const template = (await import('./ui/emailTemplates/forgotPassword'))
        .default;
      await this.emailClient.mailSend({
        to: user.email,
        subject: 'Password Reset Link',
        text: `Visit following link to update your password : ${req.ncSiteUrl}/password/reset/${token}.`,
        html: ejs.render(template, {
          resetLink: req.ncSiteUrl + `/password/reset/${token}`
        })
      });
    } catch (e) {
      console.log(
        'Warning : `mailSend` failed, Please configure emailClient configuration.'
      );
    }
    console.log(`Password reset token : ${token}`);

    this.xcMeta.audit(null, null, 'nc_audit', {
      op_type: 'AUTHENTICATION',
      op_sub_type: 'PASSWORD_FORGOT',
      user: user.email,
      description: `requested for password reset `,
      ip: req.clientIp
    });

    res.json({ msg: 'Check your email for password reset link.' });
  }

  protected async tokenValidate(req, res, next): Promise<any> {
    const token = req.params.tokenId;
    const user = await this.users
      .where({ reset_password_token: token })
      .first();
    if (!user || !user.email) {
      return next(new Error('Invalid reset url'));
    }
    if (user.reset_password_expires < new Date()) {
      return next(new Error('Password reset url expired'));
    }
    res.json(true);
  }

  protected async passwordReset(req, res, next): Promise<any> {
    const token = req.params.tokenId;
    const user = await this.users
      .where({ reset_password_token: token })
      .first();
    if (!user) {
      return next(new Error('Invalid reset url'));
    }
    if (user.reset_password_expires < new Date()) {
      return next(new Error('Password reset url expired'));
    }
    if (user.provider && user.provider !== 'local') {
      return next(new Error('Email registered via social account'));
    }

    const salt = await promisify(bcrypt.genSalt)(10);
    const password = await promisify(bcrypt.hash)(req.body.password, salt);

    await this.users
      .update({
        salt,
        password,
        reset_password_expires: null,
        reset_password_token: ''
      })
      .where({
        id: user.id
      });

    this.xcMeta.audit(null, null, 'nc_audit', {
      op_type: 'AUTHENTICATION',
      op_sub_type: 'PASSWORD_RESET',
      user: user.email,
      description: `did reset password `,
      ip: req.clientIp
    });

    res.json({ msg: 'Password reset successful' });
  }

  protected async passwordChange(req, res, next): Promise<any> {
    const { currentPassword, newPassword } = req.body;
    if (req.isAuthenticated()) {
      if (!currentPassword || !newPassword) {
        return next(new Error('Missing new/old password'));
      }
      const user = await this.users.where({ email: req.user.email }).first();
      const hashedPassword = await promisify(bcrypt.hash)(
        currentPassword,
        user.salt
      );
      if (hashedPassword !== user.password) {
        return next(new Error('Current password is wrong'));
      }

      const salt = await promisify(bcrypt.genSalt)(10);
      const password = await promisify(bcrypt.hash)(newPassword, salt);

      await this.users
        .update({
          salt,
          password
        })
        .where({ id: user.id });

      this.xcMeta.audit(null, null, 'nc_audit', {
        op_type: 'AUTHENTICATION',
        op_sub_type: 'PASSWORD_CHANGE',
        user: user.email,
        description: `changed password `,
        ip: req.clientIp
      });

      res.json({ msg: 'Password updated successfully' });
    }
  }

  protected async emailVerification(req, res, next): Promise<any> {
    const token = req.params.tokenId;
    const user = await this.users
      .where({ email_verification_token: token })
      .first();
    if (!user) {
      return next(new Error('Invalid verification url'));
    }

    await this.users
      .update({
        email_verification_token: '',
        email_verified: true
      })
      .where({ id: user.id });

    this.xcMeta.audit(null, null, 'nc_audit', {
      op_type: 'AUTHENTICATION',
      op_sub_type: 'EMAIL_VERIFICATION',
      user: user.email,
      description: `verified email `,
      ip: req.clientIp
    });

    res.json({ msg: 'Email verified successfully' });
  }

  protected async me(req, res): Promise<any> {
    res.json(req?.session?.passport?.user ?? {});
  }

  protected async updateUser(req, res): Promise<any> {
    await this.users
      .update({
        firstname: req.body.firstname,
        lastname: req.body.lastname
      })
      .where({
        id: req.user.id
      });
    res.json({ msg: 'Updated successfully' });
  }

  /* Admin apis : START */

  // @ts-ignore
  protected async isSuperAdmin(req, res, next): Promise<any> {
    if (req.session?.passport?.user?.roles?.owner) {
      return next();
    }
    res.status(401).json({ msg: 'Access denied' });
  }

  protected async isAdmin(req, res, next): Promise<any> {
    if (
      req.session?.passport?.user?.roles?.owner ||
      req.session?.passport?.user?.roles?.creator ||
      req?.session?.passport?.user?.roles?.editor
    ) {
      return next();
    }
    res.status(403).json({ msg: 'Access denied' });
  }

  protected async addAdmin(req, res, next): Promise<any> {
    // if (!this.config?.mailer || !this.emailClient) {
    //   return next(new Error('SMTP config is not found'));
    // }

    const _email = req.body.email;

    if (!_email || !validator.isEmail(_email)) {
      return next(new Error('Invalid email address'));
    }
    const email = _email.toLowerCase();
    // todo: handle roles which contains super
    if (
      !req.session?.passport?.user?.roles?.owner &&
      req.body.roles.indexOf('owner') > -1
    ) {
      return next(new Error('Insufficient privilege to add super admin role.'));
    }

    const invite_token = uuidv4();
    let count;
    const user = await this.users.where({ email }).first();
    if (user) {
      if (
        !(await this.xcMeta.isUserHaveAccessToProject(
          req.body.project_id,
          user.id
        ))
      ) {
        await this.xcMeta.projectAddUser(
          req.body.project_id,
          user.id,
          'creator'
        );
      }
    } else {
      try {
        await this.users.insert({
          invite_token,
          invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          email
        });
        count = await this.users.count('id').first();

        const { id } = await this.users.where({ email }).first();
        await this.xcMeta.projectAddUser(req.body.project_id, id, 'creator');

        if (!(await this.sendInviteEmail(email, invite_token, req))) {
          res.json({ invite_token, email });
        }
      } catch (e) {
        return next(e);
      }
    }

    Tele.emit('evt', { evt_type: 'project:invite', count: count?.count });
    this.xcMeta.audit(req.body.project_id, null, 'nc_audit', {
      op_type: 'AUTHENTICATION',
      op_sub_type: 'INVITE',
      user: req.user.email,
      description: `invited ${email} to ${req.body.project_id} project `,
      ip: req.clientIp
    });

    res.json({
      msg: 'success'
    });
  }

  protected async updateAdmin(req, res, next): Promise<any> {
    if (!req?.body?.project_id) {
      return next(new Error('Missing project id in request body.'));
    }
    if (
      req.session?.passport?.user?.roles?.owner &&
      req.session?.passport?.user?.id === +req.params.id &&
      req.body.roles.indexOf('owner') === -1
    ) {
      return next(new Error("Super admin can't remove Super role themselves"));
    }
    try {
      const user = await this.users
        .where({
          id: req.params.id
        })
        .first();

      if (!user) {
        return next(`User with id '${req.params.id}' doesn't exist`);
      }

      // todo: handle roles which contains super
      if (
        !req.session?.passport?.user?.roles?.owner &&
        req.body.roles.indexOf('owner') > -1
      ) {
        return next(
          new Error('Insufficient privilege to add super admin role.')
        );
      }

      // await this.users.update({
      //   roles: 'creator'
      // }).where({
      //   id: req.params.id
      // });
      await this.xcMeta.metaUpdate(
        req?.body?.project_id,
        null,
        'nc_projects_users',
        {
          roles: 'creator'
        },
        {
          user_id: req.params.id
        }
      );

      this.xcMeta.audit(null, null, 'nc_audit', {
        op_type: 'AUTHENTICATION',
        op_sub_type: 'ROLES_MANAGEMENT',
        user: req.user.email,
        description: `updated roles for ${user.email} with ${req.body.roles} `,
        ip: req.clientIp
      });

      res.json({
        msg: 'User details updated successfully'
      });
    } catch (e) {
      next(e);
    }
  }

  protected async deleteAdmin(req, res, next): Promise<any> {
    try {
      const { project_id } = req.query;

      if (req.session?.passport?.user?.id === +req.params.id) {
        return next(new Error("Admin can't delete themselves!"));
      }

      if (!req.session?.passport?.user?.roles?.owner) {
        const deleteUser = await this.users
          .where('id', req.params.id)
          .andWhere('roles', 'like', '%super%')
          .first();
        if (deleteUser) {
          return next(
            new Error('Insufficient privilege to delete a super admin user.')
          );
        }
      }

      XcCache.del(`${req?.query?.email}___${req?.req?.project_id}`);

      // await this.users.where('id', req.params.id).del();
      await this.xcMeta.projectRemoveUser(project_id, req.params.id);
    } catch (e) {
      return next(e);
    }
    res.json({
      msg: 'success'
    });
  }

  protected async listUsers(req, res, next): Promise<any> {
    try {
      const { offset = 0, limit = 20, query, project_id } = req.query;
      let count;

      const queryBuilder = this.users
        .select(
          'xc_users.*',
          'nc_projects_users.project_id',
          'nc_projects_users.roles as roles'
        )
        .offset(offset)
        .limit(limit);

      if (query) {
        queryBuilder.where('email', 'like', `%${query}%`);
      }
      const self = this;
      queryBuilder.leftJoin('nc_projects_users', function() {
        this.on('nc_projects_users.user_id', '=', 'xc_users.id').andOn(
          'nc_projects_users.project_id',
          '=',
          self.xcMeta.knex.raw('?', [project_id])
        );
      });

      if (!req.session?.passport?.user?.roles?.owner) {
        queryBuilder.whereNot('nc_projects_users.roles', 'like', '%owner%');
        count = (
          await this.users
            .count('id as count')
            .whereNot('roles', 'like', '%owner%')
            .first()
        ).count;
      } else {
        count = (
          await this.users
            .count('id as count')
            .where('email', 'like', `%${query}%`)
            .first()
        ).count;
      }
      const list = (await queryBuilder).map(
        ({ password, salt, refresh_token, ...rest }) => rest
      );

      res.json({
        list,
        count,
        offset,
        limit
      });
    } catch (e) {
      next(e);
    }
  }

  protected async resendInvite(req, res, next): Promise<any> {
    try {
      const user = await this.users.where({ id: req.params.id }).first();

      if (!user) {
        return next(new Error(`User with id '${req.params.id}' not found`));
      }

      req.body.roles = user.roles;
      const invite_token = uuidv4();

      await this.users
        .update({
          invite_token,
          invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })
        .where({
          id: user.id
        });
      await this.sendInviteEmail(user.email, invite_token, req);

      this.xcMeta.audit(null, null, 'nc_audit', {
        op_type: 'AUTHENTICATION',
        op_sub_type: 'RESEND_INVITE',
        user: user.email,
        description: `resent a invite to ${user.email} `,
        ip: req.clientIp
      });

      res.json({ msg: 'success' });
    } catch (e) {
      next(e);
    }
  }

  protected async sendInviteEmail(email, token, req): Promise<any> {
    try {
      const template = (await import('./ui/emailTemplates/invite')).default;

      if (this.emailClient) {
        await this.emailClient.mailSend({
          to: email,
          subject: 'Verify email',
          html: ejs.render(template, {
            signupLink: `${req.ncSiteUrl}${this.config?.dashboardPath}#/user/authentication/signup/${token}`,
            projectName: req.body?.projectName,
            roles: (req.body?.roles || '')
              .split(',')
              .map(r => r.replace(/^./, m => m.toUpperCase()))
              .join(', '),
            adminEmail: req.session?.passport?.user?.email
          })
        });
        return true;
      }
      // throw new Error('SMTP not configured, sending email failed')
      // } else {
      //   await this.xcSendInviteEmail({
      //     fromEmail: req.session?.passport?.user?.email,
      //     projectName: 'NocoDB',
      //     inviteUrl: `${req.ncSiteUrl}${this.config?.dashboardPath}#/user/authentication/signup/${token}`,
      //     toEmail: email
      //   })
      // }
    } catch (e) {
      console.log(
        'Warning : `mailSend` failed, Please configure emailClient configuration.',
        e.message
      );
      throw e;
    }
  }

  protected async saveOrUpdateRoles(req, res, next): Promise<any> {
    try {
      // todo: optimize transaction
      for (const role of req.body.roles) {
        if (role.id) {
          const oldRole = await this.xcMeta.metaGet('', '', NC_ROLES, {
            id: role.id
          });

          if (
            oldRole.title !== role.title ||
            oldRole.description !== role.description
          ) {
            await this.xcMeta.metaUpdate(
              '',
              '',
              NC_ROLES,
              {
                ...role
              },
              {
                id: role.id
              }
            );
          }
          if (oldRole.title !== role.title) {
            for (const builder of (this.app as Noco).getBuilders()) {
              try {
                await this.xcMeta.startTransaction();
                const aclRows = await this.xcMeta.metaList(
                  '',
                  builder.getDbAlias(),
                  NC_ACL
                );
                for (const aclRow of aclRows) {
                  if (aclRow.acl) {
                    const acl = JSON.parse(aclRow.acl);
                    acl[role.title] = acl[oldRole.title];
                    delete acl[oldRole.title];
                    await this.xcMeta.metaUpdate(
                      '',
                      builder.getDbAlias(),
                      NC_ACL,
                      {
                        acl: JSON.stringify(acl)
                      },
                      aclRow.id
                    );
                  }
                }
                await this.xcMeta.commit();
              } catch (e) {
                await this.xcMeta.rollback(e);
              }
            }
          }
        } else {
          if (
            await this.xcMeta.metaGet('', '', NC_ROLES, { title: role.title })
          ) {
            return next(Error(`Role name '${role.title}' already exist`));
          }

          await this.xcMeta.metaInsert('', '', NC_ROLES, role);

          for (const builder of (this.app as Noco).getBuilders()) {
            try {
              await this.xcMeta.startTransaction();
              const aclRows = await this.xcMeta.metaList(
                '',
                builder.getDbAlias(),
                NC_ACL
              );
              for (const aclRow of aclRows) {
                if (aclRow.acl) {
                  const acl = JSON.parse(aclRow.acl);
                  acl[role.title] = true;
                  await this.xcMeta.metaUpdate(
                    '',
                    builder.getDbAlias(),
                    NC_ACL,
                    {
                      acl: JSON.stringify(acl)
                    },
                    {
                      id: aclRow.id
                    }
                  );
                }
              }
              await this.xcMeta.commit();
            } catch (e) {
              await this.xcMeta.rollback(e);
            }
          }
        }
      }

      this.xcMeta.audit(null, null, 'nc_audit', {
        op_type: 'AUTHENTICATION',
        op_sub_type: 'ROLES_MANAGEMENT',
        user: req.user.email,
        description: `updated roles `,
        ip: req.clientIp
      });

      res.json({ msg: 'success' });
    } catch (e) {
      next(e);
    }
  }

  // @ts-ignore
  protected async deleteRole(req, res, next): Promise<any> {
    try {
      const role = await this.xcMeta.metaGet('', '', NC_ROLES, {
        id: req.params.id
      });
      if (!role) {
        return next(new Error(`Role with id '${req.params.id}' not found`));
      }
      const deleteRoleName = role.title;

      // todo: update acl in all other database connection
      for (const builder of (this.app as Noco).getBuilders()) {
        try {
          await this.xcMeta.startTransaction();
          const aclRows = await this.xcMeta.metaList(
            '',
            builder.getDbAlias(),
            NC_ACL
          );
          for (const aclRow of aclRows) {
            if (aclRow.acl) {
              const acl = JSON.parse(aclRow.acl);
              delete acl[deleteRoleName];
              await this.xcMeta.metaUpdate(
                '',
                builder.getDbAlias(),
                NC_ACL,
                {
                  acl: JSON.stringify(acl)
                },
                {
                  id: aclRow.id
                }
              );
            }
          }
          await this.xcMeta.commit();
        } catch (e) {
          this.xcMeta.rollback(e);
        }
      }

      await this.xcMeta.metaDelete('', '', NC_ROLES, { id: req.params.id });
      res.json({ msg: 'success' });
    } catch (e) {
      next(e);
    }
  }

  protected async listRoles(_req, res, next): Promise<any> {
    try {
      res.json(await this.xcMeta.metaList('', '', NC_ROLES));
    } catch (e) {
      next(e);
    }
  }

  /* Admin apis */
  protected async createAuthTableIfNotExists(): Promise<any> {
    if (!(await this.dbDriver.schema.hasTable('xc_users'))) {
      await this.dbDriver.schema.createTable('xc_users', function(table) {
        table.increments();
        table.string('email');
        table.string('password', 255);
        table.string('salt', 255);
        table.string('firstname');
        table.string('lastname');
        table.string('username');
        table.string('refresh_token', 255);
        table.string('invite_token', 255);
        table.string('invite_token_expires', 255);
        table.timestamp('reset_password_expires');
        table.string('reset_password_token', 255);
        table.string('email_verification_token', 255);
        table.boolean('email_verified');
        table.string('roles', 255).defaultTo('editor');
        table.timestamps();
      });
    }
  }

  protected setTokenCookie(res, token): void {
    // create http only cookie with refresh token that expires in 7 days
    const cookieOptions = {
      httpOnly: true,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
    res.cookie('refresh_token', token, cookieOptions);
  }

  protected randomTokenString(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  // protected async xcSendInviteEmail(reqBody: {
  //   fromEmail: string;
  //   toEmail: string;
  //   inviteUrl: string
  //   projectName: string;
  // }): Promise<any> {
  //   try {
  //     await axios.post('https://nocodb.com/api/v1/invite', reqBody);
  //   } catch (_e) {
  //   }
  // }

  protected get emailClient(): IEmailAdapter {
    return this.app?.metaMgr?.emailAdapter;
  }

  public async loadLatestApiTokens(): Promise<any> {
    this.apiTokens = await this.xcMeta.metaList(null, null, 'nc_api_tokens');
  }
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
