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
import { User } from '~/models';
import { NcError } from '~/helpers/catchError';
import { isDisposableEmail } from '~/helpers';

//users array to hold
// let users = [];
const config = {
  auth: {
    issuer: 'http://www.okta.com/exkat9e9uuxi8dIgn697',
    entryPoint:
      'https://trial-9277567.okta.com/app/trial-9277567_nocodbdevtest_1/exkat9e9uuxi8dIgn697/sso/saml',
    cert: 'MIIDqjCCApKgAwIBAgIGAY0cZQcmMA0GCSqGSIb3DQEBCwUAMIGVMQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzENMAsGA1UECgwET2t0YTEUMBIGA1UECwwLU1NPUHJvdmlkZXIxFjAUBgNVBAMMDXRyaWFsLTkyNzc1NjcxHDAaBgkqhkiG9w0BCQEWDWluZm9Ab2t0YS5jb20wHhcNMjQwMTE4MTE0NTM5WhcNMzQwMTE4MTE0NjM5WjCBlTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xDTALBgNVBAoMBE9rdGExFDASBgNVBAsMC1NTT1Byb3ZpZGVyMRYwFAYDVQQDDA10cmlhbC05Mjc3NTY3MRwwGgYJKoZIhvcNAQkBFg1pbmZvQG9rdGEuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1B4KZ3Qr06c7g6y3TsoPwev1DF9EVVcQTzRp76Ut3L/vDCOWHNbdvY+qZtO4HTIdmOTQkv0z5HVGtvjzvk6GXchkKiN4CAGxkfkASrwHr7nzCbFZxPZGjYa6fzyMZRnIhfK81g6eTJU/Y7LAmZm/GsMumJwpnDs8vY9Bj/G2sdaJfzErwtYpjsmWk3FmFpI8k5lMJ6ODzEKg4Pq40nbdyO0mzP1AeJZc9oPgar9i0/Pd4I6ykKzt0K8ljzcIUewDQRG5HYoI3egaSRXnoEFhupLJlf0U3BOWkz0BkhM2O7yZeUKoX+zjd7j2+Qb1TKijoJxeUYCH83fD5R2v1/Kx7QIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQDLEWPrhp4NhLHlt3Go2VTXWXVkDxN06dZ/lzrOSvHuDZCsYRKXgNyCI459jFlHPNrzH8NXn265qBa5k6ZrtPpSlYRpSjwoKsPtmDqO4dmceZXq6ITx2PTnl3xp0xj/FN2BYUAJn0LzvUcJpaUaj6hvRTdbx56PWQJ1pCVHqgft6Ir36V7C0NMzv9W6FcRJ9bRosGzHAxlwvXOJwy5wkWyV8pgSgj1a93crQ9xTPUmag9h7yyhkTlNereOTftclguA/JuAcnPeEj7qQ3EAHcdfTDHFdj9SQNiXp8XKfeCHInCxWiw9VHxtOFwnjX9HOEWpisgou/SarRFQBT/7ws3/Y',
  },
};

const samlConfig = {
  issuer: config.auth.issuer,
  path: '/login/callback',
  entryPoint: config.auth.entryPoint,
  cert: config.auth.cert,
};

/**
 * find if user is available in userStore,
 * if yes, createToken and proceed
 * else return user not registered
 */
async function findByEmail(email, done) {
  try {
    const user = await User.getByEmail(email);
    if (user) {
      return done(null, sanitiseUserObj(user));
    } else {
      return done(new Error('user does not exists'));
    }
  } catch (err) {
    return done(err);
  }
}

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
passport.serializeUser(function (user, done) {
  console.log('user before serializerUser');
  console.log(user);
  // TODO: check the significance of not passing nameID here.
  // changed from user.nameID to user from ref impl
  done(null, user);
});

passport.deserializeUser(function (id, done) {
  findByEmail(id, function (err, user) {
    done(err, user);
  });
});
async function verify(profile, done) {
  console.log('Succesfully verify' + profile);
  console.log(profile);
  // if (!profile.email) {
  //     return done(new Error("No email found"), null);
  // }
  process.nextTick(function () {
    console.log('process.nextTick' + profile);
    const email = profile.nameID;
    // for signon
    findByEmail(profile.email, function (err, user) {
      if (err) {
        return done(err);
      }

      // Here, you can generate a JWT token using profile information
      const token = jwt.sign(
        { email: profile.email, saml: true,},
        'your-secret-key',
        {
          expiresIn: '5m',
        },
      );

      return done(null, { profile, token });
    });
  });
}

// TODO:  old implementation starts here
@Injectable()
export class NocoSamlStrategy extends PassportStrategy(SamlStrategy, 'saml') {
  constructor(
    private configService: ConfigService<AppConfig>,
    private usersService: UsersService,
  ) {
    super(samlConfig, verify);
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
