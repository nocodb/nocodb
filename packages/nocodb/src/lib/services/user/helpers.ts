import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../../models/User';
import { NcConfig } from '../../../interface/config';
import { Response } from 'express';

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

export function setTokenCookie(res: Response, token): void {
  // create http only cookie with refresh token that expires in 7 days
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
  res.cookie('refresh_token', token, cookieOptions);
}
