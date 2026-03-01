import { Injectable } from '@nestjs/common';
import { ApiTokensService as ApiTokensServiceCE } from 'src/services/api-tokens.service';
import type { ApiTokenReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class ApiTokensService extends ApiTokensServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @EEOnly()
  async apiTokenCreate(param: {
    userId: string;
    tokenBody: ApiTokenReqType;
    req: NcRequest;
  }) {
    return await super.apiTokenCreate(param);
  }
}
