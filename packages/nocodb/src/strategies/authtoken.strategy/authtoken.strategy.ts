import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { extractRolesObj, ProjectRoles } from 'nocodb-sdk';
import { Strategy } from 'passport-custom';
import type { Request } from 'express';
import { ApiToken, BaseUser, User } from '~/models';
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

        if (!apiToken.fk_user_id) {
          user.base_roles = extractRolesObj(ProjectRoles.EDITOR);
          return callback(null, user);
        }

        const dbUser: Record<string, any> = await User.get(apiToken.fk_user_id);
        if (!dbUser) {
          return callback({ msg: 'User not found' });
        }

        Object.assign(user, {
          id: dbUser.id,
          roles: extractRolesObj(dbUser.roles),
        });

        if (req['ncProjectId']) {
          const baseUser = await BaseUser.get(req['ncProjectId'], dbUser.id);
          user.base_roles = extractRolesObj(baseUser?.roles);
          if (user.base_roles.owner) {
            user.base_roles.creator = true;
          }
          return callback(null, sanitiseUserObj(user));
        }
      }
      return callback(null, sanitiseUserObj(user));
    } catch (error) {
      return callback(error);
    }
  }
}
