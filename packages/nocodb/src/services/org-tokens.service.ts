import { Injectable } from '@nestjs/common';
import { AppEvents, extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
import type { User } from '~/models';
import type { ApiTokenReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { ApiToken } from '~/models';

@Injectable()
export class OrgTokensService {
  constructor(protected readonly appHooksService: AppHooksService) {}

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

  async apiTokenCreate(param: {
    user: User;
    apiToken: ApiTokenReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ApiTokenReq',
      param.apiToken,
    );

    const apiToken = await ApiToken.insert({
      ...param.apiToken,
      fk_user_id: param['user'].id,
    });

    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_CREATE, {
      tokenTitle: apiToken.description,
      userId: param.user?.id,
      tokenId: apiToken.id,
      req: param.req,
    });

    return apiToken;
  }

  async apiTokenDelete(param: { user: User; tokenId: string; req: NcRequest }) {
    const fk_user_id = param.user.id;
    const apiToken = await ApiToken.get(param.tokenId);
    if (
      !extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN] &&
      apiToken.fk_user_id !== fk_user_id
    ) {
      NcError.notFound('Token not found');
    }
    const res = await ApiToken.delete(param.tokenId);

    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_DELETE, {
      tokenId: param.tokenId,
      tokenTitle: apiToken.description,
      userId: param.user?.id,
      req: param['req'],
    });

    return res;
  }
}
