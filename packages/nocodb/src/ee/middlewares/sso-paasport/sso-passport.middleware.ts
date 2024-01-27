import process from 'process';
import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { Strategy as SAMLStrategy } from '@node-saml/passport-saml';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { Strategy as OpenIDConnectStrategy } from '@techpass/passport-openidconnect';
import passport from 'passport';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { OpenIDClientConfigType } from 'nocodb-sdk';
import type { AppConfig } from '~/interface/config';
import SSOClient from '~/models/SSOClient';

import { BaseUser, User } from '~/models';
import { sanitiseUserObj } from '~/utils';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';
import { UsersService } from '~/services/users/users.service';

@Injectable()
export class SSOPassportMiddleware implements NestMiddleware {
  constructor(
    private config: ConfigService<AppConfig>,
    private usersService: UsersService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (!req.params.clientId) return next();

    // get client by id
    const client = await SSOClient.get(req.params.clientId);

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

    const clientConfig = {
      issuer: config.issuer,
      entryPoint: config.entryPoint,
      cert: config.cert,
      callbackUrl: req.ncSiteUrl + `/sso/${client.id}/redirect`,
      passReqToCallback: true,
      // logoutUrl: process.env.NC_SAML_ENTRY_POINT,
      // logoutCallbackUrl:`/sso/${client.id}/logout-redirect`',
    };

    return new SAMLStrategy(
      clientConfig,
      async (req, profile, callback) => {
        try {
          const email = profile.nameID;
          let user: any;
          user = await User.getByEmail(email);
          if (user) {
            // if base id defined extract base level roles
            if (req.ncBaseId) {
              user = await BaseUser.get(req.ncBaseId, user.id).then(
                async (baseUser) => {
                  user.roles = baseUser?.roles || user.roles;
                  return sanitiseUserObj(user);
                },
              );
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
              req,
            });
            user = sanitiseUserObj(user);
          }

          // Here, you can generate a JWT token using profile information
          const token = jwt.sign(
            { id: user.id, email: email, saml: true },
            'your-secret-key',
            {
              expiresIn: '1m',
            },
          );

          return callback(null, { ...user, token });
        } catch (e) {
          callback(e);
        }
      },
      (req, profile, done) => {
        done(null, profile);
      },
    );
  }

  private async getOIDCStrategy(client: SSOClient, _req: Request) {
    const config = client.config as OpenIDClientConfigType;

    // OpenID Connect
    const clientConfig = {
      // todo: add issuer or replace
      issuer: (config as any).issuer,
      authorizationURL: config.authUrl,
      tokenURL: config.tokenUrl,
      userInfoURL: config.userInfoUrl,
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      scope: config.scopes || ['profile', 'email'],

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
      (_issuer, _subject, profile, done) => {
        const email = profile.email || profile?._json?.email;

        if (!email) {
          return done({ msg: `User account is missing email id` });
        }

        // get user by email
        User.getByEmail(email)
          .then(async (user) => {
            if (user) {
              return done(null, {
                ...sanitiseUserObj(user),
                provider: 'openid',
                display_name: profile._json?.name,
              });
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
                  // todo: check if req available
                  req: null,
                })
                .then((user) => {
                  done(null, { ...sanitiseUserObj(user), provider: 'openid' });
                })
                .catch((e) => done(e));
            }
          })
          .catch((err) => {
            return done(err);
          });
      },
    );
  }
}
