import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { extractRolesObj } from 'nocodb-sdk';
import { ProjectUser, User } from '~/models';
import { UsersService } from '~/services/users/users.service';
import WorkspaceUser from '~/models/WorkspaceUser';
import { sanitiseUserObj } from '~/utils';
import { NcError } from '~/helpers/catchError';

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
      NcError.unauthorized('Token Expired. Please login again.');
    }

    const [workspaceRoles, projectRoles] = await Promise.all([
      // extract workspace evel roles
      new Promise((resolve) => {
        if (req.ncWorkspaceId) {
          // todo: cache
          // extract workspace role
          WorkspaceUser.get(req.ncWorkspaceId, user.id)
            .then((workspaceUser) => {
              if (workspaceUser?.roles) {
                resolve(extractRolesObj(workspaceUser.roles));
              } else {
                resolve(null);
              }
            })
            .catch(() => resolve(null));
        } else {
          resolve(null);
        }
      }) as Promise<ReturnType<typeof extractRolesObj> | null>,
      // extract project level roles
      new Promise((resolve) => {
        if (req.ncProjectId) {
          ProjectUser.get(req.ncProjectId, user.id).then(
            async (projectUser) => {
              let roles = projectUser?.roles;
              roles = roles === 'owner' ? 'owner,creator' : roles;
              // + (user.roles ? `,${user.roles}` : '');
              if (roles) {
                resolve(extractRolesObj(roles));
              } else {
                resolve(null);
              }
              // todo: cache
            },
          );
        } else {
          resolve(null);
        }
      }) as Promise<ReturnType<typeof extractRolesObj> | null>,
    ]);

    return {
      ...sanitiseUserObj(user),
      roles: user.roles ? extractRolesObj(user.roles) : null,
      workspace_roles: workspaceRoles ? workspaceRoles : null,
      project_roles: projectRoles ? projectRoles : null,
      provider: jwtPayload.provider ?? undefined,
    };
  }
}
