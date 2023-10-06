import { Injectable } from '@nestjs/common';
import { OrgTokensService as OrgTokensServiceCE } from 'src/services/org-tokens.service';
import type { User } from '~/models';
import type { ApiTokenReqType } from 'nocodb-sdk';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ApiToken } from '~/models';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class OrgTokensService extends OrgTokensServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async apiTokenCreate(param: { user: User; apiToken: ApiTokenReqType }) {
    if (await ApiToken.count({ fk_user_id: param.user.id })) {
      NcError.badRequest('Only one token per user is allowed');
    }

    return await super.apiTokenCreate(param);
  }
}
