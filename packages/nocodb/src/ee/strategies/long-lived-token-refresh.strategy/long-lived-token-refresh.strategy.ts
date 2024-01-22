import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {ExtractJwt, Strategy} from 'passport-jwt';
import { User } from '~/models';
import { UsersService } from '~/services/users/users.service';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class LongLivedTokenRefreshStrategy extends PassportStrategy(
  Strategy,
  'long-lived-token-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromHeader('xc-auth-short-lived'),
      passReqToCallback: true,
      expiresIn: '5m',
      secretOrKey: 'your-secret-key',
    });
  }

  async validate(req, jwtPayload) {
    if (!jwtPayload?.email) return jwtPayload;

    const user = await User.getByEmail(jwtPayload?.email);

    if (
      !user.token_version ||
      !jwtPayload.token_version ||
      user.token_version !== jwtPayload.token_version
    ) {
      NcError.unauthorized('Token Expired. Please login again.');
    }
    return {
      saml: jwtPayload.saml,
      ...(await User.getWithRoles(user.id, {
        user,
        baseId: req.ncBaseId,
        workspaceId: req.ncWorkspaceId,
      })),
      provider: jwtPayload.provider ?? undefined,
      isAuthorized: true,
    };
  }
}
