import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { NcConfig } from '../../../interface/config';
import { User } from '../../models';

export function genJwt(user: User, config: NcConfig) {
  return jwt.sign(
    {
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      id: user.id,
      roles: user.roles,
      token_version: user.token_version,
    },
    config.auth.jwt.secret,
    config.auth.jwt.options
  );
}

export function randomTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}
