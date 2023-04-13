import { Injectable } from '@nestjs/common';
import { OrgUserRoles } from 'nocodb-sdk';
import { T } from 'nc-help';
import { validatePayload } from '../../helpers';
import { NcError } from '../../helpers/catchError';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import { ApiToken } from '../../models';
import type { User } from '../../models';
import type { ApiTokenReqType } from 'nocodb-sdk';
import extractRolesObj from '../../utils/extractRolesObj'

@Injectable()
export class OrgTokensService {
  async apiTokenList(param: { user: User; query: any }) {
    const fk_user_id = param.user.id;
    let includeUnmappedToken = false;
    if (extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN]) {
      includeUnmappedToken = true;
    }

    return new PagedResponseImpl(
      await ApiToken.listWithCreatedBy({
        ...param.query,
        fk_user_id,
        includeUnmappedToken,
      }),
      {
        ...param.query,
        count: await ApiToken.count({
          includeUnmappedToken,
          fk_user_id,
        }),
      },
    );
  }

  async apiTokenCreate(param: { user: User; apiToken: ApiTokenReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/ApiTokenReq',
      param.apiToken,
    );

    T.emit('evt', { evt_type: 'org:apiToken:created' });
    return await ApiToken.insert({
      ...param.apiToken,
      fk_user_id: param['user'].id,
    });
  }

  async apiTokenDelete(param: { user: User; token: string }) {
    const fk_user_id = param.user.id;
    const apiToken = await ApiToken.getByToken(param.token);
    if (
      !extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN] &&
      apiToken.fk_user_id !== fk_user_id
    ) {
      NcError.notFound('Token not found');
    }
    T.emit('evt', { evt_type: 'org:apiToken:deleted' });
    return await ApiToken.delete(param.token);
  }
}
