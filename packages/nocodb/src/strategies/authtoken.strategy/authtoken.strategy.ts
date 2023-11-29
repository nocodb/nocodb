import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { extractRolesObj, ProjectRoles } from 'nocodb-sdk';
import { Strategy } from 'passport-custom';
import type { Request } from 'express';
import { ApiToken, User } from '~/models';
import { sanitiseUserObj } from '~/utils';

@Injectable()
export class AuthTokenStrategy extends PassportStrategy(Strategy, 'authtoken') {
  // eslint-disable-next-line @typescript-eslint/ban-types
  async validate(req: Request, callback: Function) {
    try {
      let user;
      if (req.headers['xc-token']) {
        const apiToken = await ApiToken.getByToken(req.headers['xc-token']);
        if (!apiToken) {
          return callback({ msg: 'Invalid token' });
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

        Object.assign(user, {
          id: dbUser.id,
          roles: extractRolesObj(dbUser.roles),
          base_roles: extractRolesObj(dbUser.base_roles),
          ...(dbUser.workspace_roles
            ? { workspace_roles: extractRolesObj(dbUser.workspace_roles) }
            : {}),
        });
      }
      return callback(null, sanitiseUserObj(user));
    } catch (error) {
      return callback(error);
    }
  }
}
