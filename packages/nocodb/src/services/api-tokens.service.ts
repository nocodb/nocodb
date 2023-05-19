import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { AppEvents, OrgUserRoles } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError';
import { ApiToken } from '../models';
import extractRolesObj from '../utils/extractRolesObj';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { User } from '../models';
import type { ApiTokenReqType } from 'nocodb-sdk';

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
