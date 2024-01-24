import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { Strategy as SamlStrategy } from 'passport-saml';
import * as jwt from 'jsonwebtoken';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import type { AppConfig } from '~/interface/config';
import { sanitiseUserObj } from '~/utils';
import { UsersService } from '~/services/users/users.service';
import { BaseUser, User } from '~/models';

@Injectable()
export class NocoSamlStrategy extends PassportStrategy(SamlStrategy, 'saml') {
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

export const NocoSamlStrategyProvider: FactoryProvider = {
  provide: OpenidStrategy,
  inject: [UsersService, ConfigService<AppConfig>],
  useFactory: async (
    usersService: UsersService,
    config: ConfigService<AppConfig>,
  ) => {
    // OpenID Connect
    if (
      process.env.NC_SAML_ISSUER &&
      process.env.NC_SAML_ENTRY_POINT &&
      process.env.NC_SAML_CERT
    ) {
      const clientConfig = {
        issuer: process.env.NC_SAML_ISSUER,
        entryPoint: process.env.NC_SAML_ENTRY_POINT,
        cert: process.env.NC_SAML_CERT,
        path: '/login/callback',
        passReqToCallback: true,
      };

      return new NocoSamlStrategy(clientConfig, config, usersService);
    }
    return null;
  },
};
