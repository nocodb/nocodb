import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../../models/User';
import { NcConfig } from '../../../interface/config';

export function genJwt(user: User, config: NcConfig) {
  return jwt.sign(
    {
      email: user.email,
      avatar: user.avatar,
      display_name: user.display_name,
      user_name: user.user_name,
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
