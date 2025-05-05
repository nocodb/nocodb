import { Injectable } from '@nestjs/common';
import { ApiTokensService as ApiTokensServiceCE } from 'src/services/api-tokens.service';
import type { ApiTokenReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ApiToken } from '~/models';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ApiTokensService extends ApiTokensServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async apiTokenCreate(param: {
    userId: string;
    tokenBody: ApiTokenReqType;
    req: NcRequest;
  }) {
    return await super.apiTokenCreate(param);
  }
}
