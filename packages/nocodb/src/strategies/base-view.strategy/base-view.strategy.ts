import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { extractRolesObj } from 'nocodb-sdk';
import { Project } from '~/models';

@Injectable()
export class BaseViewStrategy extends PassportStrategy(Strategy, 'base-view') {
  // eslint-disable-next-line @typescript-eslint/ban-types
  async validate(req: any, callback: Function) {
    try {
      let user;
      if (req.headers['xc-shared-base-id']) {
        const sharedProject = await Project.getByUuid(
          req.headers['xc-shared-base-id'],
        );

        // validate project id
        if (!sharedProject || req.ncProjectId !== sharedProject.id) {
          return callback(new UnauthorizedException());
        }

        user = {
          roles: extractRolesObj(sharedProject?.roles),
          project_roles: extractRolesObj(sharedProject?.roles),
        };
      }

      callback(null, user);
    } catch (error) {
      callback(error);
    }
  }
}
