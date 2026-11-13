import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { extractRolesObj, NcBaseError, ProjectRoles } from 'nocodb-sdk';
import { Strategy } from 'passport-custom';
import type { NcRequest } from '~/interface/config';
import { ApiToken, User } from '~/models';
import { sanitiseUserObj } from '~/utils';
import { getApiTokenFromHeader } from '~/helpers';
import { apiTokenLogHint, isOutsideApiTokenBase } from '~/helpers/apiHelpers';

@Injectable()
export class AuthTokenStrategy extends PassportStrategy(Strategy, 'authtoken') {
  private readonly logger = new Logger(AuthTokenStrategy.name);

  // eslint-disable-next-line @typescript-eslint/ban-types
  async validate(req: NcRequest, callback: Function) {
    let token: string | undefined;
    try {
      let user;

      // Extract token from either xc-token header or Authorization Bearer header
      token = getApiTokenFromHeader(req);

      if (token) {
        const apiToken = await ApiToken.getByToken(token);
        if (!apiToken) {
          this.logger.debug(
            `API token ${apiTokenLogHint(token)} rejected: no matching token`,
          );
          return callback({ msg: 'Invalid token' });
        }

        // `enabled`/`expiry` were surfaced to the UI as revocation controls but
        // never consulted here, so disabling or expiring a token did nothing.
        // Same checks the EE strategy already applies.
        if (!apiToken.enabled) {
          return callback({ msg: 'Token is disabled' });
        }

        if (apiToken.expiry && new Date(apiToken.expiry) < new Date()) {
          return callback({ msg: 'Token has expired' });
        }

        // A legacy base-scoped token (`base_id` set) stays inside its base.
        if (isOutsideApiTokenBase(apiToken, req)) {
          return callback({ msg: 'Invalid token' });
        }
        req.ncApiTokenBaseId = apiToken.base_id ?? null;

        user = {
          is_api_token: true,
        };

        // old auth tokens will not have fk_user_id, so we return editor role
        if (!apiToken.fk_user_id) {
          user.base_roles = extractRolesObj(ProjectRoles.EDITOR);
          return callback(null, user);
        }

        const dbUser: Record<string, any> = await User.getWithRoles(
          req.context,
          apiToken.fk_user_id,
          {
            baseId: req['ncBaseId'],
            ...(req['ncWorkspaceId']
              ? { workspaceId: req['ncWorkspaceId'] }
              : {}),
          },
        );
        if (!dbUser) {
          return callback({ msg: 'User not found' });
        }

        User.assertNotBlocked(dbUser);

        Object.assign(user, {
          id: dbUser.id,
          email: dbUser.email,
          display_name: dbUser.display_name,
          roles: extractRolesObj(dbUser.roles),
          base_roles: extractRolesObj(dbUser.base_roles),
          is_new_user: dbUser.is_new_user,
          ...(dbUser.workspace_roles
            ? { workspace_roles: extractRolesObj(dbUser.workspace_roles) }
            : {}),
          ...(dbUser.org_roles
            ? { org_roles: extractRolesObj(dbUser.org_roles) }
            : {}),
          // Add SSO client information from the API token if available
          extra: await apiToken.getExtraForUserPayload(),
        });
      }
      return callback(null, sanitiseUserObj(user));
    } catch (error) {
      // An NcError here is a deliberate rejection (e.g. a blocked owner).
      // Anything else is a lookup failure (meta DB, cache) that the client
      // only sees as "The credential is invalid".
      if (error instanceof NcBaseError) {
        this.logger.debug(
          `API token ${apiTokenLogHint(token)} rejected: ${error.message}`,
        );
      } else {
        this.logger.error(
          `API token ${apiTokenLogHint(token)} could not be validated: ${
            error?.message
          }`,
          error?.stack,
        );
      }
      return callback(error);
    }
  }
}
