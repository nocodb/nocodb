import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
import { ProjectUser, User } from '~/models';
import { UsersService } from '~/services/users/users.service';
import { sanitiseUserObj } from '~/utils';

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
          if (roles) {
            resolve(extractRolesObj(roles));
          } else {
            resolve(null);
          }
          // todo: cache
        });
      } else {
        resolve(null);
      }
    });

    return {
      ...sanitiseUserObj(user),
      roles: user.roles ? extractRolesObj(user.roles) : null,
      project_roles: projectRoles ? projectRoles : null,
    };
  }
}
