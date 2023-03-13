import { promisify } from 'util';

import bcrypt from 'bcryptjs';
import * as ejs from 'ejs';
import * as jwt from 'jsonwebtoken';
import passport from 'passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import authSchema from './auth/schema';
import type IEmailAdapter from '../../../interface/IEmailAdapter';
import type { DbConfig, NcConfig } from '../../../interface/config';
import type { Knex, XKnex } from '../../db/sql-data-mapper';
import type Noco from '../../Noco';

const { v4: uuidv4 } = require('uuid');
const PassportLocalStrategy = require('passport-local').Strategy;
const autoBind = require('auto-bind');
const { isEmail } = require('validator');
// import swaggerUi from 'swagger-ui-express';

passport.serializeUser(function (
  { id, email, email_verified, roles, provider, firstname, lastname },
  done
) {
  done(null, {
    id,
    email,
    email_verified,
    provider,
    firstname,
    lastname,
    roles: (roles || '')
      .split(',')
      .reduce((obj, role) => ({ ...obj, [role]: true }), {}),
  });
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

export default class GqlAuthResolver {
  private app: Noco;

  private dbDriver: Knex;
  private connectionConfig: DbConfig;
  private config: NcConfig;

  private jwtOptions: any;

  constructor(
    app: Noco,
    dbDriver: XKnex,
    connectionConfig: DbConfig,
    config: NcConfig
  ) {
    this.app = app;
    this.dbDriver = dbDriver;
    this.connectionConfig = connectionConfig;
    this.config = config;
    autoBind(this);
    this.jwtOptions = {};
    this.jwtOptions.jwtFromRequest = ExtractJwt.fromHeader('xc-auth');

    this.jwtOptions.secretOrKey = this.config?.auth?.jwt?.secret ?? 'secret';
    if (this.config?.auth?.jwt?.options) {
      Object.assign(this.jwtOptions, this.config?.auth?.jwt?.options);
    }
  }

  get users() {
    return this.dbDriver('xc_users');
  }

  public async init() {
    await this.emailClient?.init();

    await this.createTableIfNotExist();

    this.initStrategies();
    this.app.router.use(passport.initialize());

    const apiPrefix = this.connectionConfig?.meta?.api?.prefix || 'v1';

    this.app.router.get('/password/reset/:token', function (req, res) {
      res.render(__dirname + '/auth/resetPassword', {
        ncPublicUrl: process.env.NC_PUBLIC_URL || '',
        token: JSON.stringify(req.params?.token),
        baseUrl: `/api/${apiPrefix}/`,
      });
    });
    this.app.router.get('/email/verify/:token', function (req, res) {
      res.render(__dirname + '/auth/emailVerify', {
        ncPublicUrl: process.env.NC_PUBLIC_URL || '',
        token: JSON.stringify(req.params?.token),
        baseUrl: `/api/${apiPrefix}/`,
      });
    });

    this.app.router.get('/signin', function (_req, res) {
      res.render(__dirname + '/auth/signin', {
        ncPublicUrl: process.env.NC_PUBLIC_URL || '',
        baseUrl: `/api/${apiPrefix}/`,
      });
    });

    this.app.router.get('/signup', function (_req, res) {
      res.render(__dirname + '/auth/signup', {
        ncPublicUrl: process.env.NC_PUBLIC_URL || '',
        baseUrl: `/api/${apiPrefix}/`,
      });
    });

    this.app.router.use(async (req, res, next) => {
      const user = await new Promise((resolve) => {
        passport.authenticate(
          'jwt',
          { session: false },
          (_err, user, _info) => {
            if (user) {
              return resolve(user);
            }
            resolve({ roles: 'guest' });
          }
        )(req, res, next);
      });

      await promisify((req as any).login.bind(req))(user);
      next();
    });
  }

  public initStrategies() {
    const self = this;

    passport.use(
      new Strategy(this.jwtOptions, (jwt_payload, done) => {
        this.users
          .where({
            email: jwt_payload?.email,
          })
          .first()
          .then((user) => {
            if (user) {
              return done(null, user);
            } else {
              return done(new Error('User not found'));
            }
          })
          .catch((err) => {
            return done(err);
          });
      })
    );

    passport.use(
      new PassportLocalStrategy(
        {
          usernameField: 'email',
          session: false,
        },
        async function (email, password, done) {
          try {
            const user = await self.users.where({ email }).first();
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
  }

  public getResolvers() {
    return {
      mapResolvers: () => ({
        SignIn: this.signin,
        SignUp: this.signup,
        Me: this.me,
        PasswordForgot: this.passwordForgot,
        PasswordReset: this.passwordReset,
        EmailValidate: this.emailVerification,
        TokenVerify: this.tokenValidate,
        ChangePassword: this.passwordChange,
      }),
    };
  }

  public getSchema() {
    return authSchema;
  }

  public async signin(args, { req, res, next }) {
    req.body = args.data;
    return new Promise((resolve, reject) => {
      passport.authenticate(
        'local',
        { session: false },
        async (err, user, info): Promise<any> => {
          try {
            if (!user || !user.email) {
              if (err) {
                return reject(err);
              }
              if (info) {
                return reject(info);
              }
              return reject({ msg: 'Your signin has failed' });
            }

            await promisify((req as any).login.bind(req))(user);

            resolve({
              token: jwt.sign(
                {
                  email: user.email,
                  firstname: user.firstname,
                  lastname: user.lastname,
                  id: user.id,
                  roles: user.roles,
                },
                this.jwtOptions.secretOrKey,
                this.config?.auth?.jwt?.options
              ),
            });
          } catch (e) {
            console.log(e);
            reject(e);
          }
        }
      )(req, res, next);
    });
  }

  public async signup(args, { req }) {
    const { email, firstname, lastname } = args.data;
    let { password } = args.data;

    if (!isEmail(email)) {
      throw new Error(`Not a valid email`);
    }

    let user = await this.users
      .where({
        email,
      })
      .first();

    if (user) {
      throw new Error(`Email '${email}' already registered`);
    }

    // if (!validator.isEmail(email)) {
    //   throw new Error({msg: `Invalid email`})
    // }

    const salt = await promisify(bcrypt.genSalt)(10);
    password = await promisify(bcrypt.hash)(password, salt);
    const email_verification_token = uuidv4();

    await this.users.insert({
      firstname,
      lastname,
      email,
      salt,
      password,
      email_verification_token,
    });

    user = await this.users
      .where({
        email,
      })
      .first();

    try {
      const template = (await import('./emailTemplate/verify')).default;
      await this.emailClient.mailSend({
        to: email,
        subject: 'Verify email',
        html: ejs.render(template, {
          verifyLink: `${req.ncSiteUrl}/email/verify/${user.email_verification_token}`,
        }),
      });
    } catch (e) {
      console.log(
        'Warning : `mailSend` failed, Please configure email configuration.'
      );
    }
    await promisify((req as any).login.bind(req))(user);

    user = (req as any).user;

    return {
      token: jwt.sign(
        {
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          id: user.id,
          roles: user.roles,
        },
        this.jwtOptions.secretOrKey,
        this.config?.auth?.jwt?.options
      ),
    };
  }

  public async passwordForgot(args, { req }) {
    const email = args.email;

    if (!email) {
      throw new Error('Please enter your email address.');
    }

    const user = await this.users.where({ email }).first();

    if (!user) {
      throw new Error('This email is not registered with us.');
    }

    const token = uuidv4();

    await this.users
      .update({
        reset_password_token: token,
        reset_password_expires: new Date(Date.now() + 60 * 60 * 1000),
      })
      .where({ id: user.id });

    try {
      const template = (await import('./emailTemplate/forgotPassword')).default;

      await this.emailClient.mailSend({
        to: user.email,
        subject: 'Password Reset Link',
        text: `Visit following link to update your password : ${req.ncSiteUrl}/password/reset/${token}.`,
        html: ejs.render(template, {
          resetLink: `${req.ncSiteUrl}/password/reset/${token}`,
        }),
      });
    } catch (e) {
      console.log(
        'Warning : `mailSend` failed, Please configure email configuration.'
      );
    }

    console.log(`Password reset token : ${token}`);

    return true;
  }

  public async tokenValidate(args) {
    const token = args.tokenId;
    const user = await this.users
      .where({ reset_password_token: token })
      .first();
    if (!user || !user.email) {
      throw new Error('Invalid token');
    }
    if (user.reset_password_expires < new Date()) {
      throw new Error('Password reset url expired');
    }

    return true;
  }

  public async passwordReset(args) {
    const token = args.tokenId;
    const user = await this.users
      .where({ reset_password_token: token })
      .first();
    if (!user) {
      throw new Error('Invalid token');
    }
    if (user.reset_password_expires < new Date()) {
      throw new Error('Password reset url expired');
    }
    if (user.provider && user.provider !== 'local') {
      throw new Error('Email registered via social account');
    }

    const salt = await promisify(bcrypt.genSalt)(10);
    const password = await promisify(bcrypt.hash)(args.password, salt);

    await this.users
      .update({
        salt,
        password,
        reset_password_expires: null,
        reset_password_token: '',
      })
      .where({
        id: user.id,
      });

    return true;
  }

  public async passwordChange(args, { req }): Promise<any> {
    const { currentPassword, newPassword } = args;
    if (!req.isAuthenticated() || !req.user.id) {
      throw new Error('Not authenticated');
    }

    if (!currentPassword || !newPassword) {
      throw new Error('Missing new/old password');
    }
    const user = await this.users.where({ email: req.user.email }).first();
    const hashedPassword = await promisify(bcrypt.hash)(
      currentPassword,
      user.salt
    );
    if (hashedPassword !== user.password) {
      throw new Error('Current password is wrong');
    }

    const salt = await promisify(bcrypt.genSalt)(10);
    const password = await promisify(bcrypt.hash)(newPassword, salt);

    await this.users
      .update({
        salt,
        password,
      })
      .where({ id: user.id });

    return true;
  }

  public async emailVerification(args) {
    const token = args.tokenId;
    const user = await this.users
      .where({ email_verification_token: token })
      .first();
    if (!user) {
      throw new Error('Invalid verification url');
    }

    await this.users
      .update({
        email_verification_token: '',
        email_verified: true,
      })
      .where({ id: user.id });

    return true;
  }

  public async me(_args, { req }) {
    return req?.user ?? {};
  }

  public async updateUser(req, res) {
    await this.users
      .update({
        firstname: req.body.firstname,
        lastname: req.body.lastname,
      })
      .where({
        id: req.user.id,
      });
    res.json({ msg: 'Updated successfully' });
  }

  private async createTableIfNotExist() {
    if (!(await this.dbDriver.schema.hasTable('xc_users'))) {
      await this.dbDriver.schema.createTable('xc_users', function (table) {
        table.increments();
        table.string('email');
        table.string('password', 255);
        table.string('salt', 255);
        table.string('firstname');
        table.string('lastname');
        table.string('username');
        table.string('refresh_token', 255);
        table.timestamp('reset_password_expires');
        table.string('reset_password_token', 255);
        table.string('email_verification_token', 255);
        table.boolean('email_verified');
        table.string('roles', 255).defaultTo('editor');
        table.timestamps();
      });
    }
  }

  private get emailClient(): IEmailAdapter {
    return this.app?.metaMgr?.emailAdapter;
  }
}
