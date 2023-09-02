import { Injectable } from '@nestjs/common';
import { AppEvents, extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
import type { User } from '~/models';
import type { ApiTokenReqType } from 'nocodb-sdk';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';
import { ApiToken } from '~/models';

@Injectable()
export class ApiTokensService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async apiTokenList(param: { userId: string }) {
    return await ApiToken.list(param.userId);
  }
  async apiTokenCreate(param: { userId: string; tokenBody: ApiTokenReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/ApiTokenReq',
      param.tokenBody,
    );

    this.appHooksService.emit(AppEvents.API_TOKEN_CREATE, {
      userId: param.userId,
      tokenBody: param.tokenBody,
    });

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

    this.appHooksService.emit(AppEvents.API_TOKEN_DELETE, {
      userId: param.user?.id,
      token: param.token,
    });

    // todo: verify token belongs to the user
    return await ApiToken.delete(param.token);
  }
}
