import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { extractRolesObj, ProjectRoles } from 'nocodb-sdk';
import { Strategy } from 'passport-custom';
import type { NcRequest } from '~/interface/config';
import { ApiToken, ApiTokenScope, User } from '~/models';
import { sanitiseUserObj } from '~/utils';
import { getApiTokenFromHeader } from '~/helpers';
import Noco from '~/Noco';

@Injectable()
export class AuthTokenStrategy extends PassportStrategy(Strategy, 'authtoken') {
  // eslint-disable-next-line @typescript-eslint/ban-types
  async validate(req: NcRequest, callback: Function) {
    try {
      let user;

      const token = getApiTokenFromHeader(req);

      if (token) {
        // getByToken handles both nc_pat_ (hash-based) and legacy (plaintext) lookup
        const apiToken = await ApiToken.getByToken(token) as ApiToken;
        if (!apiToken) {
          return callback({ msg: 'Invalid token' });
        }

        // Check if token is disabled (handles false, 0, null, undefined)
        if (!apiToken.enabled) {
          return callback({ msg: 'Token is disabled' });
        }

        // Check expiry for fine-grained tokens
        if (apiToken.expiry) {
          const expiryDate = new Date(apiToken.expiry);
          if (expiryDate < new Date()) {
            return callback({ msg: 'Token has expired' });
          }
        }

        // Load scopes for fine-grained tokens (those with token_hash)
        let matchedScope: ApiTokenScope | null = null;
        if (apiToken.token_hash) {
          const scopes = await ApiTokenScope.listByTokenId(apiToken.id);

          // On licensed EE: fine-grained token with zero scopes = all access revoked
          // (e.g., all scoped bases were deleted). On CE / unlicensed: zero scopes = org-wide.
          if (Noco.isEE() && scopes.length === 0) {
            return callback({ msg: 'Token has no valid access scopes' });
          }

          if (scopes.length > 0) {
            const requestBaseId = req['ncBaseId'];
            const requestWorkspaceId = req['ncWorkspaceId'];

            matchedScope = await ApiTokenScope.findMatchingScope(
              apiToken.id,
              requestBaseId,
              requestWorkspaceId,
            );

            // If token has scopes but none match, deny only when a specific
            // resource is being accessed. Context-free endpoints (e.g., /users/me,
            // /projects/) are allowed through — ACL + blockApiTokenAccess in
            // extract-ids middleware handles gating for those.
            if (!matchedScope && scopes.length > 0 && (requestBaseId || requestWorkspaceId)) {
              return callback({ msg: 'Token scope mismatch' });
            }
          }
        }

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

        // Parse permissions from matched scope (multi-scope model)
        let scopePermissions = null;
        if (matchedScope) {
          const parsed = matchedScope.parsePermissions();
          if (parsed) {
            scopePermissions = parsed;
          }
        }

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
          extra: await apiToken.getExtraForUserPayload(),
          // Attach fine-grained token metadata
          api_token_meta: {
            id: apiToken.id,
            scope: matchedScope
              ? {
                  id: matchedScope.id,
                  resource_type: matchedScope.resource_type,
                  resource_id: matchedScope.resource_id,
                }
              : null,
            permissions: scopePermissions,
          },
        });

        // Fire-and-forget: update last_used_at
        ApiToken.updateLastUsed(apiToken.id).catch(() => {});
      }
      return callback(null, sanitiseUserObj(user));
    } catch (error) {
      return callback(error);
    }
  }
}
