import { Injectable } from '@nestjs/common';
import { OrgTokensService as OrgTokensServiceCE } from 'src/services/org-tokens.service';
import type { User } from '~/models';
import type { ApiTokenReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class OrgTokensService extends OrgTokensServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @EEOnly()
  async apiTokenCreate(param: {
    user: User;
    apiToken: ApiTokenReqType;
    req: NcRequest;
  }) {
    return await super.apiTokenCreate(param);
  }
}
