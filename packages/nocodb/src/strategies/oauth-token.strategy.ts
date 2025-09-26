import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { extractRolesObj } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { OAuthToken, User } from '~/models';
import { sanitiseUserObj } from '~/utils';

@Injectable()
export class OAuthTokenStrategy extends PassportStrategy(
  Strategy,
  'oauth-token',
) {
  // eslint-disable-next-line @typescript-eslint/ban-types
  async validate(req: NcRequest, callback: Function) {
    try {
      // Extract Bearer token from Authorization header
      const authHeader = req.headers?.authorization;
      if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return callback({ msg: 'No Bearer token provided' });
      }

      const token = authHeader.slice(7).trim();
      if (!token) {
        return callback({ msg: 'Empty Bearer token' });
      }

      // Get OAuth token from database
      const oAuthToken = await OAuthToken.getByAccessToken(token);
      if (!oAuthToken) {
        return callback({ msg: 'Invalid OAuth token' });
      }

      if (
        oAuthToken.access_token_expires_at &&
        new Date(oAuthToken.access_token_expires_at) < new Date()
      ) {
        return callback({ msg: 'OAuth token expired' });
      }

      // Get user associated with the OAuth token
      const dbUser: Record<string, any> = await User.getWithRoles(
        req.context,
        oAuthToken.fk_user_id,
        {
          baseId: req['ncBaseId'],
          ...(req['ncWorkspaceId']
            ? { workspaceId: req['ncWorkspaceId'] }
            : {}),
        },
      );

      if (!dbUser) {
        return callback({ msg: 'User not found for OAuth token' });
      }

      // Validate resource limitations if granted_resources exist
      if (oAuthToken.granted_resources) {
        const grantedResources = oAuthToken.granted_resources;

        // Check workspace access limitation (EE only)
        if (grantedResources.workspace_id) {
          if (
            req.context?.workspace_id &&
            req.context.workspace_id !== grantedResources.workspace_id
          ) {
            return callback({
              msg: 'OAuth token access limited to specific workspace',
            });
          }
        }

        // Check base access limitation
        if (grantedResources.base_id) {
          if (
            req.context?.base_id &&
            req.context.base_id !== grantedResources.base_id
          ) {
            return callback({
              msg: 'OAuth token access limited to specific base',
            });
          }
        }
      }

      // Build user object with OAuth context
      const user = {
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

        // OAuth-specific fields
        is_oauth_token: true,
        oauth_client_id: oAuthToken.client_id,
        oauth_granted_resources: oAuthToken.granted_resources,
        oauth_scope: oAuthToken.scope,
        oauth_token_id: oAuthToken.id,
      };

      return callback(null, sanitiseUserObj(user));
    } catch (error) {
      return callback({ msg: 'OAuth token validation failed' });
    }
  }
}
