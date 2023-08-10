import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { OrgUserRoles } from 'nocodb-sdk';
import { ProjectUser, User } from '~/models';
import { UsersService } from '~/services/users/users.service';
import extractRolesObj from '~/utils/extractRolesObj';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(options, private userService: UsersService) {
    super({
      expiresIn: '10h',
      ...options,
    });
  }

  async validate(req, jwtPayload) {
    if (!jwtPayload?.email) return jwtPayload;

    // todo: improve this, caching
    if (
      req.ncProjectId &&
      extractRolesObj(jwtPayload.roles)[OrgUserRoles.SUPER_ADMIN]
    ) {
      const user = await User.getByEmail(jwtPayload?.email);

      return {
        ...user,
        roles: `owner,creator,${OrgUserRoles.SUPER_ADMIN}`,
      };
    }

    const user = await User.getByEmail(jwtPayload?.email);

    if (
      !user.token_version ||
      !jwtPayload.token_version ||
      user.token_version !== jwtPayload.token_version
    ) {
      throw new Error('Token Expired. Please login again.');
    }

    const projectRoles = await new Promise((resolve) => {
      if (req.ncProjectId) {
        ProjectUser.get(req.ncProjectId, user.id).then(async (projectUser) => {
          let roles = projectUser?.roles;
          roles = roles === 'owner' ? 'owner,creator' : roles;
          // + (user.roles ? `,${user.roles}` : '');
          resolve(roles);
          // todo: cache
        });
      } else {
        resolve(null);
      }
    });

    return {
      ...user,
      roles: extractRolesObj(
        [user.roles, projectRoles].filter(Boolean).join(','),
      ),
      projectRoles: projectRoles
        ? extractRolesObj((projectRoles as any)?.split(',').filter(Boolean))
        : null,
    };
  }
}
