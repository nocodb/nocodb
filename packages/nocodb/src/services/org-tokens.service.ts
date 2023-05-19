import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { AppEvents, OrgUserRoles } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { ApiToken } from '../models';
import extractRolesObj from '../utils/extractRolesObj';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { User } from '../models';
import type { ApiTokenReqType } from 'nocodb-sdk';

@Injectable()
export class OrgTokensService {
  constructor(private readonly appHooksService: AppHooksService) {}

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

    const apiToken = await ApiToken.insert({
      ...param.apiToken,
      fk_user_id: param['user'].id,
    });

    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_CREATE, {
      tokenBody: param.apiToken,
      userId: param.user?.id,
    });

    return apiToken;
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
    const res = await ApiToken.delete(param.token);

    this.appHooksService.emit(AppEvents.ORG_API_TOKEN_DELETE, {
      token: param.token,
      userId: param.user?.id,
    });

    return res;
  }
}
