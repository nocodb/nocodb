import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { OAuthToken, User } from '~/models';
import { UsersService } from '~/services/users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(options, private userService: UsersService) {
    super({
      expiresIn: '10h',
      ...options,
    });
  }

  async validate(req, jwtPayload) {
    if (!jwtPayload?.email || jwtPayload?.is_api_token) return jwtPayload;

    // Handle OAuth tokens
    if (jwtPayload?.client_id) {
      // This is an OAuth access token (JWT)
      const oAuthToken = await OAuthToken.getByAccessToken(
        req.headers.authorization?.replace('Bearer ', ''),
      );

      if (oAuthToken && oAuthToken.granted_resources) {
        const grantedResources = oAuthToken.granted_resources;

        // Check base access limitation (CE only has bases, no workspaces)
        if (grantedResources.base_id) {
          if (
            !req.context.base_id ||
            req.context.base_id !== grantedResources.base_id
          ) {
            NcError.forbidden('OAuth token access limited to specific base');
          }
        }

        // Add OAuth context to the payload
        jwtPayload.oauth_granted_resources = grantedResources;
        jwtPayload.oauth_client_id = oAuthToken.client_id;
        jwtPayload.is_oauth_token = true;
      }
    }

    const user = await User.getByEmail(jwtPayload?.email);

    if (
      !user.token_version ||
      !jwtPayload.token_version ||
      user.token_version !== jwtPayload.token_version
    ) {
      throw new Error('Token Expired. Please login again.');
    }
    const userWithRoles = await User.getWithRoles(req.context, user.id, {
      user,
      baseId: req.ncBaseId,
    });

    return userWithRoles && { ...userWithRoles, isAuthorized: true };
  }
}
