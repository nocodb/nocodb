import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { AppEvents } from 'nocodb-sdk';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import type { AppConfig } from '~/interface/config';
import { sanitiseUserObj } from '~/utils';
import { UsersService } from '~/services/users/users.service';
import { User } from '~/models';
import { isDisposableEmail } from '~/helpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class CognitoStrategy extends PassportStrategy(Strategy, 'cognito') {
  constructor(
    private configService: ConfigService<AppConfig>,
    private usersService: UsersService,
    private appHooksService: AppHooksService,
  ) {
    super();
  }

  async validate(req: any, callback) {
    try {
      if (
        !this.configService.get('cognito.aws_user_pools_id', { infer: true })
      ) {
        this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
          provider: 'cognito',
          reason: 'Cognito is not configured',
          req,
        });
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
        const rawEmail = (payload as any)['email']?.toLowerCase();

        if (!rawEmail) {
          this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
            provider: 'cognito',
            reason: 'Invalid token - no email',
            req,
          });
          return callback('Invalid token');
        }

        // Reject plus addressing (always abusive)
        if (rawEmail.split('@')[0].includes('+')) {
          this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
            email: rawEmail,
            provider: 'cognito',
            reason: 'Plus addressing not allowed',
            req,
          });
          return callback(
            new Error(
              'Email aliases with "+" are not allowed. Please use your primary email address.',
            ),
          );
        }

        // check if email is disposable and throw error
        if (isDisposableEmail(rawEmail)) {
          this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
            email: rawEmail,
            provider: 'cognito',
            reason: 'Disposable email',
            req,
          });
          return callback(
            new Error(
              'For the security and integrity of NocoDB platform, we require users to sign up with a permanent email address. Please provide a valid, long-term email address to continue.',
            ),
          );
        }

        // Login: use exact email match to avoid returning wrong user
        const user = await User.getByEmail(rawEmail);

        if (user) {
          return callback(null, {
            ...sanitiseUserObj(user),
            provider: 'cognito',
          });
        }

        try {
          // if user not found create new user
          const salt = await promisify(bcrypt.genSalt)(10);
          const newUser = await this.usersService.registerNewUserIfAllowed({
            email: rawEmail,
            password: '',
            email_verification_token: null,
            avatar: (payload as any)['picture'],
            user_name: null,
            display_name: (payload as any)['name'],
            salt,
            req,
          });

          return callback(null, {
            ...sanitiseUserObj(newUser),
            provider: 'cognito',
          });
        } catch (err) {
          this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
            email: rawEmail,
            provider: 'cognito',
            reason: 'Registration failed',
            req,
          });
          return callback(new Error('Token validation failed'));
        }
      } else {
        this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
          provider: 'cognito',
          reason: 'No token found',
          req,
        });
        return callback(new Error('No token found'));
      }
    } catch (error) {
      this.appHooksService.emit(AppEvents.USER_SIGNIN_FAILED, {
        provider: 'cognito',
        reason: 'Token verification failed',
        req,
      });
      return callback(error);
    }
  }
}

export const CognitoStrategyProvider: FactoryProvider = {
  provide: CognitoStrategy,
  inject: [UsersService, ConfigService<AppConfig>, AppHooksService],
  useFactory: async (
    usersService: UsersService,
    config: ConfigService<AppConfig>,
    appHooksService: AppHooksService,
  ) => {
    return new CognitoStrategy(config, usersService, appHooksService);
  },
};
