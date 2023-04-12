import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ApiToken, ProjectUser, User } from '../../models';
import type { Request } from 'express';

@Injectable()
export class AuthTokenStrategy extends PassportStrategy(Strategy, 'authtoken') {
  constructor() {
    super(
      {
        headerFields: ['xc-token'],
        passReqToCallback: true,
      },
    );
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  async validate(req: Request, token: string, done: Function) {
    try {
      const apiToken = await ApiToken.getByToken(token);
      if (!apiToken) {
        return done({ msg: 'Invalid token' });
      }

      const user: any = {};
      if (!apiToken.fk_user_id) {
        user.roles = 'editor';
        return done(null, user);
      }

      const dbUser: Record<string, any> = await User.get(apiToken.fk_user_id);
      if (!dbUser) {
        return done({ msg: 'User not found' });
      }

      dbUser.is_api_token = true;
      if (req['ncProjectId']) {
        const projectUser = await ProjectUser.get(
          req['ncProjectId'],
          dbUser.id,
        );
        user.roles = projectUser?.roles || dbUser.roles;
        user.roles = user.roles === 'owner' ? 'owner,creator' : user.roles;
        // + (user.roles ? `,${user.roles}` : '');
        // todo : cache
        // await NocoCache.set(`${CacheScope.USER}:${key}`, user);
        return done(null, user);
      }

      return done(null, dbUser);
    } catch (error) {
      return done(error);
    }
  }
}
