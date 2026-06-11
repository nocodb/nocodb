import crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import type User from '~/models/User';
import type { NcConfig } from '~/interface/config';
import type { Response } from 'express';
import { NC_REFRESH_TOKEN_EXP_IN_DAYS } from '~/constants';
import { ncSiteUrl } from '~/utils/envs';

export function genJwt(
  user: User & { extra?: Record<string, any> },
  config: NcConfig,
  jwtOptions: {
    expiresIn?: string;
  } = {},
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
    { expiresIn: '10h', ...(config.auth.jwt.options as any), ...jwtOptions },
  );
}

export function randomTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function setTokenCookie(res: Response, token, req?: any): void {
  // create http only cookie with refresh token that expires in 7 days
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: req?.ncSiteUrl
      ? req.ncSiteUrl.startsWith('https')
      : !!ncSiteUrl?.startsWith('https'),
    expires: new Date(
      Date.now() + NC_REFRESH_TOKEN_EXP_IN_DAYS * 24 * 60 * 60 * 1000,
    ),
    domain: process.env.NC_BASE_HOST_NAME || undefined,
  };
  res.cookie('refresh_token', token, cookieOptions);
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie('nc_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!ncSiteUrl?.startsWith('https'),
    path: '/api',
    maxAge: 10 * 60 * 60 * 1000, // 10 hours — match JWT expiry
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('nc_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!ncSiteUrl?.startsWith('https'),
    path: '/api',
  });
}
