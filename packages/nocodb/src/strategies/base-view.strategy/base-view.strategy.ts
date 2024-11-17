import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { extractRolesObj } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { Base } from '~/models';

@Injectable()
export class BaseViewStrategy extends PassportStrategy(Strategy, 'base-view') {
  // eslint-disable-next-line @typescript-eslint/ban-types
  async validate(req: NcRequest, callback: Function) {
    try {
      let user;
      if (req.headers['xc-shared-base-id']) {
        const sharedProject = await Base.getByUuid(
          req.context,
          req.headers['xc-shared-base-id'],
        );

        // validate base id
        if (!sharedProject || req.ncBaseId !== sharedProject.id) {
          return callback(new UnauthorizedException());
        }

        user = {
          roles: extractRolesObj(sharedProject?.roles),
          base_roles: extractRolesObj(sharedProject?.roles),
        };
      }

      callback(null, user);
    } catch (error) {
      callback(error);
    }
  }
}
