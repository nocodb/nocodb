import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { NOCO_SERVICE_USERS, ProjectRoles } from 'nocodb-sdk';
import { User } from '~/models';
import { UsersService } from '~/services/users/users.service';
import { NcError } from '~/helpers/catchError';

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

    if (jwtPayload?.email === NOCO_SERVICE_USERS.AUTOMATION_USER.email) {
      // Avoid service user to get access to other workspaces and bases
      if (
        !jwtPayload?.context?.workspace_id ||
        req.context.workspace_id !== jwtPayload.context.workspace_id
      ) {
        NcError.forbidden('User access limited to Workspace');
      }
      if (
        !jwtPayload?.context?.base_id ||
        req.context.base_id !== jwtPayload.context.base_id
      ) {
        NcError.forbidden('User access limited to Base');
      }

      return {
        ...jwtPayload,
        base_roles: ProjectRoles.EDITOR,
        isAuthorized: true,
        // always treat automation user like accessing via API Token
        is_api_token: true,
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
