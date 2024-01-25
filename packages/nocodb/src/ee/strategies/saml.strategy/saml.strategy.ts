import { promisify } from 'util';
import process from 'process';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import * as jwt from 'jsonwebtoken';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import type { AppConfig } from '~/interface/config';
import { sanitiseUserObj } from '~/utils';
import { UsersService } from '~/services/users/users.service';
import { BaseUser, User } from '~/models';
import boxen from "boxen";

@Injectable()
export class SamlStrategy extends PassportStrategy(SamlStrategy, 'saml') {
  constructor(
    config: any,
    private configService: ConfigService<AppConfig>,
    private usersService: UsersService,
  ) {
    super(config);
  }

  async validate(req, profile) {
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

    return { ...user, token };
  }
}

const requiredEnvKeys = [
  'NC_SSO_SAML_ISSUER',
  'NC_SSO_SAML_ENTRY_POINT',
  'NC_SSO_SAML_CERT',
];

export const SamlStrategyProvider: FactoryProvider = {
  provide: SamlStrategy,
  inject: [UsersService, ConfigService<AppConfig>],
  useFactory: async (
    usersService: UsersService,
    config: ConfigService<AppConfig>,
  ) => {
    if (process.env.NC_SSO?.toLowerCase() !== 'saml') {
      return null;
    }

    // check if all required env keys are present
    const missingKeys = requiredEnvKeys.filter((key) => !process.env[key]);

    if (missingKeys.length) {
      console.log(
        boxen(
          `SAML SSO is enabled but missing required env keys: ${missingKeys.join(
            ', ',
          )}`,
          {
            padding: 1,
            margin: 1,
            borderStyle: 'double',
            title: 'Missing Environment Values',
          },
        ),
      );
      process.exit(0);
    }

    const clientConfig = {
      issuer: process.env.NC_SSO_SAML_ISSUER,
      entryPoint: process.env.NC_SSO_SAML_ENTRY_POINT,
      cert: process.env.NC_SSO_SAML_CERT,
      path: '/auth/saml/callback',
      passReqToCallback: true,
      // logoutUrl: process.env.NC_SAML_ENTRY_POINT,
      // logoutCallbackUrl: '/login/callback',
    };

    return new SamlStrategy(clientConfig, config, usersService);
  },
};
