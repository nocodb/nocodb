import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { User } from '~/models';
import { UsersService } from '~/services/users/users.service';
import { NcError } from '~/helpers/ncError';
import Noco from '~/Noco';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(options, private userService: UsersService) {
    super({
      expiresIn: '10h',
      ...options,
    });
  }

  async validate(req, jwtPayload) {
    // Principals that are not console sessions and never came off the wire.
    // GlobalGuard.authenticate() calls this method directly with a payload IT
    // built — the anonymous guest, and the shared-base pseudo-user — and
    // neither carries an email. Passport can never produce either: it only
    // reaches here with a payload that verified against the console secret.
    if (
      jwtPayload?.is_api_token ||
      jwtPayload?.is_oauth_token ||
      jwtPayload?.roles?.guest ||
      jwtPayload?.isPublicBase
    ) {
      return jwtPayload;
    }

    // Everything else here IS a verified console token, and a console session
    // always carries an email. One that does not is a token from another realm
    // reaching the wrong door, so it is refused rather than returned as the
    // principal — returning it authenticated the request with the payload
    // standing in for a user.
    if (!jwtPayload?.email) {
      NcError.get().unauthorized('Invalid token');
    }

    const user = await User.getByEmail(jwtPayload?.email);

    if (!user) {
      NcError.get().unauthorized('Token Expired. Please login again.');
    }

    User.assertNotBlocked(user);

    if (
      !user.token_version ||
      !jwtPayload.token_version ||
      user.token_version !== jwtPayload.token_version
    ) {
      NcError.get().unauthorized('Token Expired. Please login again.');
    }
    const userWithRoles = await User.getWithRoles(req.context, user.id, {
      user,
      baseId: req.ncBaseId,
      workspaceId: req.ncWorkspaceId || Noco.ncDefaultWorkspaceId || undefined,
    });

    return userWithRoles && { ...userWithRoles, isAuthorized: true };
  }
}
