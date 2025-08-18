import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ProjectRoles } from 'nocodb-sdk';
import { User } from '~/models';
import { UsersService } from '~/services/users/users.service';
import { NcError } from '~/helpers/catchError';
import { AUTOMATION_USER } from '~/utils/globals';

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

    if (jwtPayload?.email === AUTOMATION_USER.email) {
      return {
        ...jwtPayload,
        base_roles: ProjectRoles.EDITOR,
        provider: jwtPayload.provider ?? undefined,
        isAuthorized: true,
      };
    }

    const user = await User.getByEmail(jwtPayload?.email);

    if (user?.blocked) {
      NcError.unauthorized(
        user.blocked_reason || 'User is blocked. Please contact administrator.',
      );
    }

    if (
      !user.token_version ||
      !jwtPayload.token_version ||
      user.token_version !== jwtPayload.token_version
    ) {
      NcError.unauthorized('Token Expired. Please login again.');
    }
    return {
      ...(await User.getWithRoles(req.context, user.id, {
        user,
        baseId: req.ncBaseId,
        workspaceId: req.ncWorkspaceId,
        orgId: req.ncOrgId,
      })),
      provider: jwtPayload.provider ?? undefined,
      isAuthorized: true,

      extra: {
        org_id: jwtPayload.org_id,
        workspace_id: jwtPayload.workspace_id,
        sso_client_id: jwtPayload.sso_client_id,
        sso_client_type: jwtPayload.sso_client_type,
      },
    };
  }
}
