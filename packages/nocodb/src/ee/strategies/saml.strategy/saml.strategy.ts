import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { Strategy as SamlStrategy } from 'passport-saml';
import passport from 'passport';
import * as jwt from 'jsonwebtoken';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import type { AppConfig } from '~/interface/config';
import { sanitiseUserObj } from '~/utils';
import { UsersService } from '~/services/users/users.service';
import { BaseUser, User } from '~/models';
import { NcError } from '~/helpers/catchError';
import { isDisposableEmail } from '~/helpers';

//users array to hold
// let users = [];
// const config = {
//   auth: {
//     issuer: 'http://www.okta.com/exkat9e9uuxi8dIgn697',
//     entryPoint:
//       'https://trial-9277567.okta.com/app/trial-9277567_nocodbdevtest_1/exkat9e9uuxi8dIgn697/sso/saml',
//     cert: 'MIIDqjCCApKgAwIBAgIGAY0cZQcmMA0GCSqGSIb3DQEBCwUAMIGVMQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzENMAsGA1UECgwET2t0YTEUMBIGA1UECwwLU1NPUHJvdmlkZXIxFjAUBgNVBAMMDXRyaWFsLTkyNzc1NjcxHDAaBgkqhkiG9w0BCQEWDWluZm9Ab2t0YS5jb20wHhcNMjQwMTE4MTE0NTM5WhcNMzQwMTE4MTE0NjM5WjCBlTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xDTALBgNVBAoMBE9rdGExFDASBgNVBAsMC1NTT1Byb3ZpZGVyMRYwFAYDVQQDDA10cmlhbC05Mjc3NTY3MRwwGgYJKoZIhvcNAQkBFg1pbmZvQG9rdGEuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1B4KZ3Qr06c7g6y3TsoPwev1DF9EVVcQTzRp76Ut3L/vDCOWHNbdvY+qZtO4HTIdmOTQkv0z5HVGtvjzvk6GXchkKiN4CAGxkfkASrwHr7nzCbFZxPZGjYa6fzyMZRnIhfK81g6eTJU/Y7LAmZm/GsMumJwpnDs8vY9Bj/G2sdaJfzErwtYpjsmWk3FmFpI8k5lMJ6ODzEKg4Pq40nbdyO0mzP1AeJZc9oPgar9i0/Pd4I6ykKzt0K8ljzcIUewDQRG5HYoI3egaSRXnoEFhupLJlf0U3BOWkz0BkhM2O7yZeUKoX+zjd7j2+Qb1TKijoJxeUYCH83fD5R2v1/Kx7QIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQDLEWPrhp4NhLHlt3Go2VTXWXVkDxN06dZ/lzrOSvHuDZCsYRKXgNyCI459jFlHPNrzH8NXn265qBa5k6ZrtPpSlYRpSjwoKsPtmDqO4dmceZXq6ITx2PTnl3xp0xj/FN2BYUAJn0LzvUcJpaUaj6hvRTdbx56PWQJ1pCVHqgft6Ir36V7C0NMzv9W6FcRJ9bRosGzHAxlwvXOJwy5wkWyV8pgSgj1a93crQ9xTPUmag9h7yyhkTlNereOTftclguA/JuAcnPeEj7qQ3EAHcdfTDHFdj9SQNiXp8XKfeCHInCxWiw9VHxtOFwnjX9HOEWpisgou/SarRFQBT/7ws3/Y',
//   },
// };
// const config = {
//   auth: {
//     issuer: 'http://localhost:8080/realms/master',
//     entryPoint:
//       'http://localhost:8080/realms/master/protocol/saml',
//     cert: 'MIICmzCCAYMCBgGNNQvpXzANBgkqhkiG9w0BAQsFADARMQ8wDQYDVQQDDAZub2NvZGIwHhcNMjQwMTIzMDYzODA5WhcNMzQwMTIzMDYzOTQ5WjARMQ8wDQYDVQQDDAZub2NvZGIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC+i3qj6H21yTkb53T/S7PQvGShWgp/+6LRI1gHAb1f/7i2P4YFvW1kSkFC30XM8T80Rso8VYYDrNlFC2eSoeER5UdGd8M7btwOaos1QZA+a+14cF7m9EP1Qzc5AAoD4sKDpEBPt+BP68D8Rmpv1S6iYPkTtLJ3A3LJgV1GnXexLOdI8U5umGZmNZd0Qb0RDWZEP21ZLIEL3VOrCc0jJ0UyJVoFEA7grGfwa1I70EkYMjrFsRjHPhP/d0KS055iWVlprB5QXMrW6tptYVxfvgzroFDETWIH5E7oTO3gwOOO9cKU2HQk9clJhTlDHfQeKxYWUTVKAcqSy2t8Rb7GgSupAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAIWuPj7TOhUq24p64gEs/4ePijDB6CJOH9wmLeM8gBM92k69tzRE0ZW1ChUxQ0prJwzQVGTXWfFdJ/CRW0N/2mWO0rUCyrOsrj4fp0nGsCCo5XsTKaZRgS9H49v7v14CLvEEEF8n6floiQ/acA96eX22mpe0iVYQI2YcM2v4b4mwuGKtG7PbXyKYsSOxAO4evYhMKILuREDICigMgqVaZxXGzWdDHPKt9lEjt7mPSM8BMOFyEWnebyTx6w9wF9iO05aSwFTyKZLqlDKb/abLRkbIMyMUuP0gkB4JmTdEega4PiagGWTxp9hinVYCOQRB0S0TnO9YqN6aKU3Q3HwOfcc=',
//   },
// };
const config = {
  auth: {
    issuer: 'http://localhost:8080/realms/master',
    entryPoint: 'http://localhost:8080/realms/master/protocol/saml',
    cert: 'MIICmzCCAYMCBgGNNQqdfDANBgkqhkiG9w0BAQsFADARMQ8wDQYDVQQDDAZtYXN0ZXIwHhcNMjQwMTIzMDYzNjQ0WhcNMzQwMTIzMDYzODI0WjARMQ8wDQYDVQQDDAZtYXN0ZXIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCx/my8KOYq3ap0lFnb6FTSKbQ0nu0qYbo0ogKqXtKsQQF5/JX1CRyLJGnrUU6gJu4aI6XljoxEJhjGieRyN7DMxUHetY7RPhuLLpq/20ceDMd0Igf1S4Q9KChrsFm77g0s/2qVLCaTuciOkk2x6UpX4Evbg8wBAm8XPnfU+rGFPon2DY7jHjPefQTYU2RcWC9yi797jgKFnnmNqyAzQ1NGK9qEM+9jghqBDVJpCUIlU0wQ7ZGRNkolIeUr1RcudXx+WCSRZ4/pzKpywFZZQlfpJQv5WxRYlOHh8V2gyEEJVL1SRpQuySmbArHkQH+dSNRVjMh+qlMg8Fzx2aZUYbvVAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAEHi+2CFnQygvxKXDbZXe+ReHdD0FeuLRoHB/EH9qlZAp4LzouvkGLBO2q1GPjCzfnVgTAqcofUYlh+xELlH5Fndb3d7/oiApAAIZL+2rbDC93Ay9ZaQXWrp+UzM3BJq80fCiTmGg3xvsIv1dfKA5536HnD3LM2Vtzg/PgPOP/jP7VZAoZKSm6YPb1xsgz07VH7WcU1zhaojYsWlh1qXDgGO3MGW7WINjIbLIM5I+nHGxdtEN2NK+b2c3DSGX7p6CExmgR+/B3cNYc/y1BQrFpHerOROzM+Q2XMKGEvhEh12aNVlkSi0rWaVskQ4+1o/2ABrIe2rcMbsmyAzr9i3ikw=',
  },
};

const samlConfig = {
  issuer: config.auth.issuer,
  path: '/login/callback',
  entryPoint: config.auth.entryPoint,
  cert: config.auth.cert,
  passReqToCallback: true,
};

// /**
//  * find if user is available in userStore,
//  * if yes, createToken and proceed
//  * else return user not registered
//  */
// async function findByEmail(email, done) {
//   try {
//     const user = await User.getByEmail(email);
//     if (user) {
//       return done(null, sanitiseUserObj(user));
//     } else {
//       return done(new Error('user does not exists'));
//     }
//   } catch (err) {
//     return done(err);
//   }
// }
//
// // Passport session setup.
// //   To support persistent login sessions, Passport needs to be able to
// //   serialize users into and deserialize users out of the session.  Typically,
// //   this will be as simple as storing the user ID when serializing, and finding
// //   the user by ID when deserializing.
// passport.serializeUser(function (user, done) {
//   console.log('user before serializerUser');
//   console.log(user);
//   // TODO: check the significance of not passing nameID here.
//   // changed from user.nameID to user from ref impl
//   done(null, user);
// });
//
// passport.deserializeUser(function (id, done) {
//   findByEmail(id, function (err, user) {
//     done(err, user);
//   });
// });

// TODO:  old implementation starts here
@Injectable()
export class NocoSamlStrategy extends PassportStrategy(SamlStrategy, 'saml') {
  constructor(
    private configService: ConfigService<AppConfig>,
    private usersService: UsersService,
  ) {
    super(samlConfig);
  }

  async validate(req, profile, done) {
    console.log('Succesfully verify' + profile);
    console.log(profile);
    // if (!profile.email) {
    //     return done(new Error("No email found"), null);
    // }

    console.log('process.nextTick' + JSON.stringify(profile));
    const email = profile.nameID;
    let user: any;
    user = await User.getByEmail(email);
    if (user) {
      // if base id defined extract base level roles
      if (req.ncBaseId) {
        user = await BaseUser.get(req.ncBaseId, user.id).then(
          async (baseUser) => {
            user.roles = baseUser?.roles || user.roles;
            // + (user.roles ? `,${user.roles}` : '');

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

export const NocoSamlStrategyProvider: FactoryProvider = {
  provide: NocoSamlStrategy,
  inject: [UsersService, ConfigService<AppConfig>],
  useFactory: async (
    usersService: UsersService,
    config: ConfigService<AppConfig>,
  ) => {
    return new NocoSamlStrategy(config, usersService);
  },
};
