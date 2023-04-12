import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Project } from '../../models'
import extractRolesObj from '../../utils/extractRolesObj'

@Injectable()
export class BaseViewStrategy extends PassportStrategy(Strategy, 'base-view') {
  // eslint-disable-next-line @typescript-eslint/ban-types
  async validate(req: any, callback: Function) {
    try {
      let user;
      if (req.headers['xc-shared-base-id']) {
        // const cacheKey = `nc_shared_bases||${req.headers['xc-shared-base-id']}`;

        let sharedProject = null;

        if (!sharedProject) {
          sharedProject = await Project.getByUuid(
            req.headers['xc-shared-base-id']
          );
        }
        user = {
          roles: extractRolesObj(sharedProject?.roles),
        };
      }

      callback(null, user);
    } catch (error) {
      callback(error);
    }
  }
}
