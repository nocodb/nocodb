import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import type { AppConfig } from '~/interface/config';
import { sanitiseUserObj } from '~/utils';
import { UsersService } from '~/services/users/users.service';
import { User } from '~/models';

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
        // todo: replace with env/config
        const verifier = CognitoJwtVerifier.create(
          {
            userPoolId: this.configService.get('cognito.aws_user_pools_id', {
              infer: true,
            }),
            tokenUse: 'id',
            clientId: this.configService.get(
              'cognito.aws_user_pools_web_client_id',
              { infer: true },
            ),
          },
        );

        const payload = await verifier.verify(req.headers['xc-cognito']);
        const email = (payload as any)['email'];
        // get user by email
        await User.getByEmail(email).then(async (user) => {
          if (user) {
            return callback(null, {
              ...sanitiseUserObj(user),
              provider: 'cognito',
              // display_name: profile._json?.name,
              display_name: '',
            });
          } else {
            try {
              // if user not found create new user
              const salt = await promisify(bcrypt.genSalt)(10);
              const user = await this.usersService.registerNewUserIfAllowed({
                email,
                password: '',
                email_verification_token: null,
                avatar: null,
                user_name: null,
                display_name: '',
                // display_name: profile._json?.name,
                salt,
              });

              return callback(null, {
                ...sanitiseUserObj(user),
                provider: 'openid',
              });
            } catch (err) {
              return callback('Token validation failed');
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
