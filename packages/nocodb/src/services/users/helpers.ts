import crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import type User from '~/models/User';
import type { NcConfig } from '~/interface/config';
import type { Response } from 'express';
import { NC_REFRESH_TOKEN_EXP_IN_DAYS } from '~/constants';

export function genJwt(
  user: User & { extra?: Record<string, any> },
  config: NcConfig,
) {
  return jwt.sign(
    {
      ...(user.extra || {}),
      email: user.email,
      id: user.id,
      roles: user.roles,
      token_version: user.token_version,
    },
    config.auth.jwt.secret,
    // todo: better typing
    { expiresIn: '10h', ...(config.auth.jwt.options as any) },
  );
}

export function randomTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function setTokenCookie(res: Response, token): void {
  // create http only cookie with refresh token that expires in 7 days
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(
      Date.now() + NC_REFRESH_TOKEN_EXP_IN_DAYS * 24 * 60 * 60 * 1000,
    ),
    domain: process.env.NC_BASE_HOST_NAME || undefined,
  };
  res.cookie('refresh_token', token, cookieOptions);
}
