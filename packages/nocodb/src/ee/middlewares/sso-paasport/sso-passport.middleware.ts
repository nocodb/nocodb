import process from 'process';
import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { Strategy as SAMLStrategy } from '@node-saml/passport-saml';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { Strategy as OpenIDConnectStrategy } from '@techpass/passport-openidconnect';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import passport from 'passport';
import isEmail from 'validator/lib/isEmail';
import { CloudOrgUserRoles } from 'nocodb-sdk';
import type {
  GoogleClientConfigType,
  OpenIDClientConfigType,
} from 'nocodb-sdk';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '~/interface/config';
import SSOClient from '~/models/SSOClient';

import { BaseUser, Domain, OrgUser, User } from '~/models';
import { sanitiseUserObj, verifyTXTRecord } from '~/utils';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';
import { UsersService } from '~/services/users/users.service';
import { MetaService } from '~/meta/meta.service';
import { NcError } from '~/helpers/catchError';

// this middleware is used to authenticate user using passport
// in which we decide which strategy to use based on client type
// it's all done dynamically based on client id(sso-client)
@Injectable()
export class SSOPassportMiddleware implements NestMiddleware {
  constructor(
    private config: ConfigService<AppConfig>,
    private usersService: UsersService,
    private metaService: MetaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (!req.params.clientId) return next();

    // get client by id
    const client = await SSOClient.get(req.params.clientId);

    req['ncOrgId'] = client.fk_org_id;

    if (!client || !client.enabled || client.deleted) {
      return res.status(400).json({
        msg: `Client not found`,
      });
    }

    if (!client.config) {
      return res.status(400).json({
        msg: `Client config not found`,
      });
    }

    let strategy;
    if (client.type === 'oidc') {
      strategy = await this.getOIDCStrategy(client, req);
    } else if (client.type === 'saml') {
      strategy = await this.getSAMLStrategy(client, req);
    } else if (client.type === 'google') {
      strategy = await this.getGoogleStrategy(client, req);
    } else {
      return res.status(400).json({
        msg: `Client not supported`,
      });
    }

    passport.authenticate(strategy, { session: false })(req, res, next);
  }

  // get saml strategy
  async getSAMLStrategy(client: SSOClient, req: Request) {
    const config: any = client.config;

    // issuer and audience should be same and should be unique for each client
    // by default in all clients audience is same as entityId by default
    return new SAMLStrategy(
      {
        issuer: config.issuer ?? req.ncSiteUrl + `/sso/${client.id}`,
        entryPoint: config.entryPoint,
        cert: config.cert,
        callbackUrl: req.ncSiteUrl + `/sso/${client.id}/redirect`,
        audience: config.audience ?? req.ncSiteUrl + `/sso/${client.id}`,
        passReqToCallback: true,
        // disable signature verification for response since enabling this will
        // disable assertion signing in some providers
        // it's(response signing) disabled by default in most of the providers ( Azure AD and Auth0 )
        wantAuthnResponseSigned: false,
        // Azure AD otp based auth is not supporting with authContext
        // https://github.com/node-saml/passport-saml/issues/226
        disableRequestedAuthnContext:
          config.disableRequestedAuthnContext ?? true,
      },
      async (req, profile, callback) => {
        try {
          const email = profile.nameID;

          await this.validateEmailDomain({ email, req, client });

          if (!isEmail(email)) {
            return callback(
              new Error(
                'NameID is not a valid email address and cannot be used as a user identifier. Please contact your administrator.',
              ),
            );
          }

          let user: any;
          user = await User.getByEmail(email);
          if (user) {
            // if base id defined extract base level roles
            if (req.ncBaseId) {
              user = await BaseUser.get(
                (req as any).context,
                req.ncBaseId,
                user.id,
              ).then(async (baseUser) => {
                user.roles = baseUser?.roles || user.roles;
                return sanitiseUserObj(user);
              });
            } else {
              user = sanitiseUserObj(user);
            }
            // if user not found create new user if allowed
            // or return error
          } else {
            const salt = await promisify(bcrypt.genSalt)(10);
            user = await this.usersService.registerNewUserIfAllowed({
              display_name: null,
              avatar: null,
              user_name: null,
              email_verification_token: null,
              email,
              password: '',
              salt,
              req: req as any,
            });
            user = sanitiseUserObj(user);
          }

          const config = this.metaService.config;

          const options = {
            secretOrKey: config.auth.jwt.secret,
            ...config.auth.jwt.options,
          };

          await this.addUserToOrg({ user, client });

          // Here, you can generate a JWT token using profile information
          const token = this.generateShortLivedToken({
            user,
            email,
            options,
            client,
          });

          callback(null, { ...user, token });
        } catch (e) {
          callback(e);
        }
      },
      (req, profile, done) => {
        done(null, profile);
      },
    );
  }

  private generateShortLivedToken({
    user,
    email,
    options,
    client,
  }: {
    user: any;
    email: string;
    options: any;
    client: SSOClient;
  }) {
    return jwt.sign(
      {
        id: user.id,
        email: email,
        sso_client_type: client.type,
        sso_client_id: client.id,
        org_id: client.fk_org_id ?? undefined,
      },
      options.secretOrKey,
      {
        expiresIn: '1m',
      },
    );
  }

  private async getOIDCStrategy(client: SSOClient, req: Request) {
    const config = client.config as OpenIDClientConfigType;

    // OpenID Connect
    const clientConfig = {
      issuer: (config as any).issuer,
      authorizationURL: config.authUrl,
      tokenURL: config.tokenUrl,
      userInfoURL: config.userInfoUrl,
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      scope: config.scopes || ['profile', 'email'],
      callbackURL: req.ncSiteUrl + `/sso/${client.id}/redirect`,
      pkce: 'S256',
      // cache based store for managing the state of the authorization request
      store: {
        store: async (req, meta, callback) => {
          const handle = `oidc_${uuidv4()}`;
          let host: string;
          let continueAfterSignIn: string;

          // extract workspace id from query params if available
          // and ignore if it's main sub-domain
          if (
            req.query.workspaceId &&
            req.query.workspaceId !==
              this.config.get('mainSubDomain', { infer: true })
          ) {
            host = `${req.query.workspaceId}.${process.env.NC_BASE_HOST_NAME}`;
          } else {
            // extract host from siteUrl but this approach only works with upgraded workspace
            const url = new URL(req.ncSiteUrl);
            host = url.host;
          }

          if (req.query.continueAfterSignIn) {
            continueAfterSignIn = req.query.continueAfterSignIn;
          }

          const state = { handle, host, continueAfterSignIn };
          for (const key in meta) {
            state[key] = meta[key];
          }

          NocoCache.set(`oidc:${handle}`, state)
            .then(() => callback(null, handle))
            .catch((err) => callback(err));
        },
        verify: (req, providedState, callback) => {
          const key = `oidc:${providedState}`;
          NocoCache.get(key, CacheGetType.TYPE_OBJECT)
            .then(async (state) => {
              if (!state) {
                return callback(null, false, {
                  message: 'Unable to verify authorization request state.',
                });
              }

              req.extra = {
                continueAfterSignIn: state.continueAfterSignIn,
              };
              req.ncRedirectHost = state.host;

              await NocoCache.del(key);
              return callback(null, true, state);
            })
            .catch((err) => callback(err));
        },
      },
    };

    return new OpenIDConnectStrategy(
      clientConfig,
      // todo: replace with async-await syntax
      (_issuer, _subject, profile, done) => {
        const email = profile.email || profile?._json?.email;

        if (!email) {
          return done({ msg: `User account is missing email id` });
        }

        this.validateEmailDomain({ email, req, client })
          .then(() => {
            // get user by email
            User.getByEmail(email)
              .then(async (user) => {
                const config = this.metaService.config;

                const options = {
                  secretOrKey: config.auth.jwt.secret,
                  ...config.auth.jwt.options,
                };
                // Here, you can generate a JWT token using profile information
                const getToken = (user) =>
                  this.generateShortLivedToken({
                    user,
                    email,
                    options,
                    client,
                  });
                // jwt.sign(
                //   { id: user.id, email: email, saml: true, org_id: orgId },
                //   options.secretOrKey,
                //   {
                //     expiresIn: '1m',
                //   },
                // );
                if (user) {
                  return this.addUserToOrg({ user, client })
                    .then(() => {
                      return done(null, {
                        ...sanitiseUserObj(user),
                        provider: 'openid',
                        display_name: profile._json?.name,
                        token: getToken(user),
                      });
                    })
                    .catch((e) => done(e));
                } else {
                  // if user not found create new user
                  const salt = await promisify(bcrypt.genSalt)(10);
                  await this.usersService
                    .registerNewUserIfAllowed({
                      email,
                      password: '',
                      email_verification_token: null,
                      avatar: null,
                      user_name: null,
                      display_name: profile._json?.name,
                      salt,
                      req: null,
                    })
                    .then((user) => {
                      this.addUserToOrg({ user, client })
                        .then(() => {
                          done(null, {
                            ...sanitiseUserObj(user),
                            provider: 'openid',
                            token: getToken(user),
                          });
                        })
                        .catch((e) => done(e));
                    })
                    .catch((e) => done(e));
                }
              })
              .catch((err) => {
                return done(err);
              });
          })
          .catch((e) => done(e));
      },
    );
  }

  private async validateEmailDomain({
    email,
    client,
  }: {
    email: string;
    req: Request;
    client: SSOClient;
  }) {
    const orgId = client.fk_org_id;
    if (!orgId) return;

    const domain = email.split('@')[1];

    const orgDomains = await Domain.list({ orgId });

    let domainExists = false;

    // iterate over org domains and check if domain matches and verified
    // if last verified is more than 7 days then re-verify
    for (const d of orgDomains) {
      if (d.domain === domain) {
        if (!d.verified) {
          continue;
        }

        // todo: improve and do periodic verification of domain using cron
        if (d.last_verified) {
          const lastVerified = new Date(d.last_verified).getTime();
          const now = new Date().getTime();
          const diff = now - lastVerified;
          const diffInDays = diff / (1000 * 60 * 60 * 24);
          if (diffInDays > 7) {
            const verified = await verifyTXTRecord(domain, d.txt_value);

            if (verified) {
              await Domain.update(d.id, {
                verified: true,
                last_verified: new Date(),
              });
            } else {
              await Domain.update(d.id, {
                verified: false,
                last_verified: new Date(),
              });
            }
          }
        }

        domainExists = true;
      }
    }

    if (!domainExists) {
      NcError.emailDomainNotAllowed(domain);
    }
  }

  private async getGoogleStrategy(client: SSOClient, req: Request) {
    const config = client.config as GoogleClientConfigType;

    return new GoogleStrategy(
      {
        clientID: config.clientId,
        clientSecret: config.clientSecret,
        callbackURL: req.ncSiteUrl + `/sso/${client.id}/redirect`,
        passReqToCallback: true,
        scope: ['profile', 'email'],
      },
      (req, accessToken, refreshToken, profile, done) => {
        (async () => {
          const email = profile.emails[0].value;

          await this.validateEmailDomain({ email, req, client });

          const user = await User.getByEmail(email);
          if (user) {
            // if base id defined extract base level roles
            if (req.ncBaseId) {
              return await BaseUser.get(
                (req as any).context,
                req.ncBaseId,
                user.id,
              ).then(async (baseUser) => {
                user.roles = baseUser?.roles || user.roles;
                return sanitiseUserObj(user);
              });
            } else {
              return sanitiseUserObj(user);
            }
            // if user not found create new user if allowed
            // or return error
          } else {
            const salt = await promisify(bcrypt.genSalt)(10);
            const user = await this.usersService.registerNewUserIfAllowed({
              email_verification_token: null,
              avatar: profile.photos?.[0]?.value,
              display_name: profile.displayName,
              email: profile.emails[0].value,
              user_name: profile.username,
              password: '',
              salt,
              req: req as any,
            });
            return sanitiseUserObj(user);
          }
        })()
          .then(async (user) => {
            await this.addUserToOrg({ user, client });
            return user;
          })
          .then((user) => {
            const config = this.metaService.config;

            const options = {
              secretOrKey: config.auth.jwt.secret,
              ...config.auth.jwt.options,
            };

            // Here, you can generate a JWT token using profile information
            const token = this.generateShortLivedToken({
              user,
              email: profile.emails[0].value,
              options,
              client,
            });

            done(null, { ...user, token });
          })
          .catch((err) => done(err));
      },
    );
  }

  private async addUserToOrg({
    client,
    user,
  }: {
    client: SSOClient;
    user: Partial<User>;
  }) {
    if (!client.fk_org_id) return;

    const orgUser = await OrgUser.get(client.fk_org_id, user.id);
    if (!orgUser) {
      await OrgUser.insert({
        fk_org_id: client.fk_org_id,
        fk_user_id: user.id,
        roles: CloudOrgUserRoles.VIEWER,
      });
    }
  }
}
