import { Injectable } from '@nestjs/common';
import { AppEvents, extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
import type { User } from '~/models';
import type { ApiTokenReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';
import { ApiToken } from '~/models';

@Injectable()
export class ApiTokensService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async apiTokenList(param: { userId: string }) {
    return await ApiToken.list(param.userId);
  }
  async apiTokenCreate(param: {
    userId: string;
    tokenBody: ApiTokenReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ApiTokenReq',
      param.tokenBody,
    );
    const token = await ApiToken.insert({
      ...param.tokenBody,
      fk_user_id: param.userId,
    });

    this.appHooksService.emit(AppEvents.API_TOKEN_CREATE, {
      userId: param.userId,
      tokenTitle: param.tokenBody.description,
      tokenId: token.id,
      req: param.req,
    });

    return token;
  }

  async apiTokenDelete(param: { tokenId: string; user: User; req: NcRequest }) {
    const apiToken = await ApiToken.get(param.tokenId);
    if (
      !extractRolesObj(param.user.roles)[OrgUserRoles.SUPER_ADMIN] &&
      apiToken.fk_user_id !== param.user.id
    ) {
      NcError.notFound('Token not found');
    }

    this.appHooksService.emit(AppEvents.API_TOKEN_DELETE, {
      userId: param.user?.id,
      tokenId: apiToken.id,
      tokenTitle: apiToken.description,
      req: param.req,
    });

    // todo: verify token belongs to the user
    return await ApiToken.delete(param.tokenId);
  }
}
