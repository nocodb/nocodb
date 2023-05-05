import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { OrgUserRoles } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError';
import { ApiToken } from '../models';
import extractRolesObj from '../utils/extractRolesObj';
import type { User } from '../models';
import type { ApiTokenReqType } from 'nocodb-sdk';

@Injectable()
export class ApiTokensService {
  async apiTokenList(param: { userId: string }) {
    return await ApiToken.list(param.userId);
  }
  async apiTokenCreate(param: { userId: string; tokenBody: ApiTokenReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/ApiTokenReq',
      param.tokenBody,
    );

    T.emit('evt', { evt_type: 'apiToken:created' });
    return await ApiToken.insert({
      ...param.tokenBody,
      fk_user_id: param.userId,
    });
  }

  async apiTokenDelete(param: { token; user: User }) {
    const apiToken = await ApiToken.getByToken(param.token);
    if (
      !extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN] &&
      apiToken.fk_user_id !== param.user.id
    ) {
      NcError.notFound('Token not found');
    }
    T.emit('evt', { evt_type: 'apiToken:deleted' });

    // todo: verify token belongs to the user
    return await ApiToken.delete(param.token);
  }
}
