import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { extractRolesObj } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { OAuthClient, OAuthToken, User } from '~/models';
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

      if (oAuthToken.is_revoked) {
        return callback({ msg: 'Invalid OAuth token' });
      }

      if (
        oAuthToken.access_token_expires_at &&
        new Date(oAuthToken.access_token_expires_at) < new Date()
      ) {
        return callback({ msg: 'OAuth token expired' });
      }

      // Defense in depth: a bearer is only valid while its issuing client still
      // exists. Deleting the client must terminate its tokens; reject any token
      // whose client is gone even if an orphaned token row survived (CWE-613).
      if (oAuthToken.fk_client_id) {
        const client = await OAuthClient.getByClientId(oAuthToken.fk_client_id);
        if (!client) {
          return callback({ msg: 'Invalid OAuth token' });
        }
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

      // Enforce route restriction: OAuth tokens can only access allowed routes
      // Individual endpoints can further block OAuth via @Acl('x', { blockOAuthTokenAccess: true })
      const oauthAllowedPaths = ['/mcp', '/api/v3/', '/auth/user/me'];

      if (!oauthAllowedPaths.some((p) => req.path?.startsWith(p))) {
        return callback({
          msg: 'OAuth token does not permit access to this endpoint',
        });
      }

      // Identity lookup (/auth/user/me) and MCP are the only allowed routes that
      // legitimately run WITHOUT a resource context — the former only exposes the
      // token's own identity, the latter builds context from the stored grant.
      // Every other route must resource-match a scoped grant.
      const isContextExemptPath =
        req.path?.startsWith('/auth/user/me') || req.path?.startsWith('/mcp');

      // Validate resource limitations if granted_resources exist. This must FAIL
      // CLOSED: a grant scoped to a workspace/base is only valid when the
      // request's resolved context matches. A missing context (e.g. a
      // workspace-scoped V3 route with no base_id) is a mismatch, not a licence
      // to skip the check — otherwise a base-restricted bearer reaches other
      // bases through context-less routes (CWE-863).
      if (oAuthToken.granted_resources && !isContextExemptPath) {
        const grantedResources = oAuthToken.granted_resources;

        // Check workspace access limitation (EE only)
        if (
          grantedResources.workspace_id &&
          req.context?.workspace_id !== grantedResources.workspace_id
        ) {
          return callback({
            msg: 'OAuth token access limited to specific workspace',
          });
        }

        // Check base access limitation
        if (
          grantedResources.base_id &&
          req.context?.base_id !== grantedResources.base_id
        ) {
          return callback({
            msg: 'OAuth token access limited to specific base',
          });
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
        oauth_client_id: oAuthToken.fk_client_id,
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
