import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import disposableEmailDomains from 'disposable-email-domains';
import disposableWildcardEmailDomains from 'disposable-email-domains/wildcard.json';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import type { AppConfig } from '~/interface/config';
import { sanitiseUserObj } from '~/utils';
import { UsersService } from '~/services/users/users.service';
import { User } from '~/models';
import { NcError } from '~/helpers/catchError';

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
      if (
        !this.configService.get('cognito.aws_user_pools_id', { infer: true })
      ) {
        return callback(new Error('Cognito is not configured'));
      }

      if (req.headers['xc-cognito']) {
        const verifier = CognitoJwtVerifier.create({
          userPoolId: this.configService.get('cognito.aws_user_pools_id', {
            infer: true,
          }),
          tokenUse: 'id',
          clientId: this.configService.get(
            'cognito.aws_user_pools_web_client_id',
            { infer: true },
          ),
        });

        const payload = await verifier.verify(req.headers['xc-cognito']);
        const email = (payload as any)['email']?.toLowerCase();

        if (!email) {
          return callback('Invalid token');
        }

        if (/\+/.test(email.split('@')[0])) {
          return callback(new Error("Emails with '+' are not allowed"));
        }

        // check if email is disposable and throw error
        isDisposableEmail(email);

        // get user by email
        await User.getByEmail(email).then(async (user) => {
          if (user) {
            return callback(null, {
              ...sanitiseUserObj(user),
              provider: 'cognito',
            });
          } else {
            try {
              // if user not found create new user
              const salt = await promisify(bcrypt.genSalt)(10);
              const user = await this.usersService.registerNewUserIfAllowed({
                email,
                password: '',
                email_verification_token: null,
                avatar: (payload as any)['picture'],
                user_name: null,
                display_name: (payload as any)['name'],
                salt,
              });

              return callback(null, {
                ...sanitiseUserObj(user),
                provider: 'openid',
              });
            } catch (err) {
              return callback(new Error('Token validation failed'));
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
    return new CognitoStrategy(config, usersService);
  },
};

// validate is email is temporary disposable email
export function isDisposableEmail(email: string) {
  const hostName = email.split('@')[1];

  // check for exact host name match
  if (disposableEmailDomains.includes(hostName)) {
    return NcError.badRequest('Disposable email is not allowed');
  }

  // check for wildcard host name match
  if (
    disposableWildcardEmailDomains.some((host: string) =>
      hostName.endsWith(host),
    )
  ) {
    return NcError.badRequest('Disposable email is not allowed');
  }
}
