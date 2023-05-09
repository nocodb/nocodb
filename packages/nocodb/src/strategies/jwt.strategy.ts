import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { OrgUserRoles } from 'nocodb-sdk';
import NocoCache from '../cache/NocoCache';
import { ProjectUser, User } from '../models';
import extractRolesObj from '../utils/extractRolesObj';
import { CacheGetType, CacheScope } from '../utils/globals';
import { UsersService } from '../services/users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(options, private userService: UsersService) {
    super({
      expiresIn: '10h',
      ...options,
    });
  }

  async validate(req: any, jwtPayload: any) {
    if (!jwtPayload?.email) return jwtPayload;

    // todo: improve this
    if (
      req.ncProjectId &&
      extractRolesObj(jwtPayload.roles)[OrgUserRoles.SUPER_ADMIN]
    ) {
      return User.getByEmail(jwtPayload?.email).then(async (user) => {
        return {
          ...user,
          roles: extractRolesObj(`owner,creator,${OrgUserRoles.SUPER_ADMIN}`),
        };
      });
    }

    const keyVals = [jwtPayload?.email];
    if (req.ncProjectId) {
      keyVals.push(req.ncProjectId);
    }
    const key = keyVals.join('___');
    const cachedVal = await NocoCache.get(
      `${CacheScope.USER}:${key}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (cachedVal) {
      /*todo: tobe fixed
      if (
        !cachedVal.token_version ||
        !jwtPayload.token_version ||
        cachedVal.token_version !== jwtPayload.token_version
      ) {
        throw new Error('Token Expired. Please login again.');
      }*/
      return cachedVal;
    }

    return User.getByEmail(jwtPayload?.email).then(
      async (user: { roles: any; id: string }) => {
        user.roles = extractRolesObj(user?.roles);
        /*
     todo: tobe fixed
     if (
        // !user.token_version ||
        // !jwtPayload.token_version ||
        user.token_version !== jwtPayload.token_version
      ) {
        throw new Er  ror('Token Expired. Please login again.');
      }*/
        if (req.ncProjectId) {
          // this.xcMeta
          //   .metaGet(req.ncProjectId, null, 'nc_projects_users', {
          //     user_id: user?.id
          //   })

          return ProjectUser.get(req.ncProjectId, user.id).then(
            async (projectUser) => {
              user.roles = extractRolesObj(projectUser?.roles || user.roles);
              user.roles = extractRolesObj(
                user.roles === 'owner' ? 'owner,creator' : user.roles,
              );
              // + (user.roles ? `,${user.roles}` : '');

              await NocoCache.set(`${CacheScope.USER}:${key}`, user);
              return user;
            },
          );
        } else {
          // const roles = projectUser?.roles ? JSON.parse(projectUser.roles) : {guest: true};
          if (user) {
            await NocoCache.set(`${CacheScope.USER}:${key}`, user);
            return user;
          } else {
            throw new Error('User not found');
          }
        }
      },
    );
  }
}
